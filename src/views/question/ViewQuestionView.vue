<template>
  <div id="viewQuestionView">
    <a-row :gutter="[24, 24]">
      <!-- 左侧：题目信息 -->
      <a-col :md="12" :xs="24">
        <a-tabs default-active-key="question">
          <a-tab-pane key="question" title="题目">
            <a-card v-if="question" :title="question.title">
              <a-descriptions
                title="判题条件"
                :column="{ xs: 1, md: 2, lg: 3 }"
              >
                <a-descriptions-item label="时间限制">
                  {{ question.judgeConfig?.timeLimit ?? 0 }}
                </a-descriptions-item>
                <a-descriptions-item label="内存限制">
                  {{ question.judgeConfig?.memoryLimit ?? 0 }}
                </a-descriptions-item>
                <a-descriptions-item label="堆栈限制">
                  {{ question.judgeConfig?.stackLimit ?? 0 }}
                </a-descriptions-item>
              </a-descriptions>
              <MdViewer :value="question.content || ''" />
              <template #extra>
                <a-space wrap>
                  <a-tag
                    v-for="(tag, index) of question.tags"
                    :key="index"
                    color="green"
                    >{{ tag }}</a-tag
                  >
                </a-space>
              </template>
            </a-card>
          </a-tab-pane>
          <a-tab-pane key="answer" title="答案">
            <div v-if="isAdmin">{{ question?.answer ?? "" }}</div>
            <div v-else>暂无权限查看答案</div>
          </a-tab-pane>
        </a-tabs>
      </a-col>

      <!-- 右侧：代码编辑与结果展示 -->
      <a-col :md="12" :xs="24">
        <a-form :model="form" layout="inline">
          <a-form-item
            field="language"
            label="编程语言"
            style="min-width: 240px"
          >
            <a-select
              v-model="form.language"
              :style="{ width: '320px' }"
              placeholder="选择编程语言"
            >
              <a-option>java</a-option>
              <a-option>cpp</a-option>
              <a-option>go</a-option>
              <a-option>html</a-option>
            </a-select>
          </a-form-item>
        </a-form>
        <CodeEditor
          :value="form.code as string"
          :language="form.language"
          :handle-change="changeCode"
        />
        <a-divider size="0" />
        <a-space>
          <a-button
            type="primary"
            style="min-width: 200px"
            @click="doSubmitOptimized"
            :loading="submittingOptimized"
          >
            提交代码
          </a-button>
          <a-button
            type="primary"
            style="min-width: 200px"
            @click="doSubmitWeak"
            :loading="submittingWeak"
          >
            获取反馈
          </a-button>
        </a-space>

        <!-- 判题结果展示 -->
        <div v-if="judgeResult" class="judge-card">
          <a-alert :type="judgeResult.status === 2 ? 'success' : 'warning'">
            <template #title>
              {{ judgeResult.status === 2 ? "✅ 判题通过" : "❌ 判题失败" }}
            </template>
            <div class="judge-metrics">
              ⏱️ 耗时：{{ judgeInfo.time ?? 0 }} ms &nbsp;|&nbsp; 💾 内存：{{
                judgeInfo.memory ?? 0
              }}
              KB
            </div>
            <div v-if="judgeInfo.message" class="judge-message">
              判题信息：{{ judgeInfo.message }}
            </div>
          </a-alert>
        </div>

        <!-- DeepSeek 反馈展示 -->
        <div v-if="feedback" class="feedback-card">
          <a-alert
            :type="feedback.errorType === '无错误' ? 'success' : 'warning'"
          >
            <template #title>
              {{
                !feedback.errorType
                  ? "⚠️ 分析异常"
                  : feedback.errorType === "无错误"
                  ? "✅ 代码正确"
                  : "🔍 发现问题：" + feedback.errorType
              }}
            </template>
            <div class="explanation">{{ feedback.explanation }}</div>
            <div v-if="feedback.hint" class="hint">
              💡 提示：{{ feedback.hint }}
            </div>
          </a-alert>
        </div>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, withDefaults, defineProps, type Ref } from "vue";
import {
  QuestionControllerService,
  QuestionSubmitAddRequest,
  QuestionVO,
} from "../../../generated";
import message from "@arco-design/web-vue/es/message";
import CodeEditor from "@/components/CodeEditor.vue";
import MdViewer from "@/components/MdViewer.vue";
import axios from "axios";
import store from "@/store";
import ACCESS_ENUM from "@/access/accessEnum";
import checkAccess from "@/access/checkAccess";

// 设置 axios 全局配置
axios.defaults.baseURL = "http://localhost:8121";
axios.defaults.withCredentials = true;

interface Props {
  id: string;
}
const props = withDefaults(defineProps<Props>(), {
  id: () => "",
});

const question = ref<QuestionVO>();
const submittingOptimized = ref(false);
const submittingWeak = ref(false);
const feedback = ref<any>(null);
const judgeResult = ref<any>(null);
const judgeInfo = ref<any>({});
let pollTimer: ReturnType<typeof setInterval> | null = null;

const form = ref<QuestionSubmitAddRequest>({
  language: "python",
  code: "",
});

const loadData = async () => {
  const res = await QuestionControllerService.getQuestionVoByIdUsingGet(
    props.id as any
  );
  if (res.code === 0) {
    question.value = res.data;
  } else {
    message.error("加载失败，" + res.message);
  }
};

// 安全解析 judgeInfo
const parseJudgeInfo = (judgeInfoData: any) => {
  if (!judgeInfoData) return {};
  if (typeof judgeInfoData === "string") {
    try {
      return JSON.parse(judgeInfoData);
    } catch (e) {
      console.warn("judgeInfo 不是合法 JSON，使用原始字符串", judgeInfoData);
      return { message: judgeInfoData };
    }
  }
  return judgeInfoData;
};

// 通用提交和轮询（移除超时逻辑）
const submitAndPoll = async (apiPath: string, loadingRef: Ref<boolean>) => {
  if (!question.value?.id) return;

  // 重置状态
  judgeResult.value = null;
  judgeInfo.value = {};
  feedback.value = null;
  if (pollTimer) clearInterval(pollTimer);
  loadingRef.value = true;

  try {
    const res = await axios.post(apiPath, {
      ...form.value,
      questionId: question.value.id,
    });
    if (res.status !== 200 || res.data.code !== 0) {
      message.error("提交失败，" + (res.data.message || "未知错误"));
      loadingRef.value = false;
      return;
    }
    const submitId = res.data.data;
    message.success("提交成功，正在判题和分析...");

    let hasJudge = false;
    let hasFeedback = false;

    pollTimer = setInterval(async () => {
      // 轮询判题结果
      if (!hasJudge) {
        try {
          const judgeRes = await axios.get(
            `/api/question_submit/submission/${submitId}/judge`
          );
          const data = judgeRes.data.data;
          if (data && (data.status === 2 || data.status === 3)) {
            judgeResult.value = data;
            judgeInfo.value = parseJudgeInfo(data.judgeInfo);
            hasJudge = true;
          }
        } catch (err) {
          console.error("判题轮询错误", err);
        }
      }

      // 轮询 DeepSeek 反馈
      if (!hasFeedback) {
        try {
          const dsRes = await axios.get(
            `/api/question_submit/submission/${submitId}/deepseek`
          );
          const feedbackData = dsRes.data.data;
          if (feedbackData && feedbackData !== "null" && feedbackData !== "") {
            try {
              feedback.value = JSON.parse(feedbackData);
            } catch {
              feedback.value = { explanation: feedbackData };
            }
            hasFeedback = true;
          }
        } catch (err) {
          console.error("反馈轮询错误", err);
        }
      }

      // 两者均获取到后停止轮询
      if (hasJudge && hasFeedback) {
        clearInterval(pollTimer!);
        loadingRef.value = false;
        message.success("分析完成");
      }
    }, 2000);
  } catch (error: any) {
    console.error(error);
    message.error("提交失败，" + error.message);
    loadingRef.value = false;
  }
};

let loginUser = store.state.user.loginUser;
const needAccess = ACCESS_ENUM.ADMIN;
const isAdmin = checkAccess(loginUser, ACCESS_ENUM.ADMIN);

const doSubmitOptimized = () =>
  submitAndPoll("/api/question_submit/optimized", submittingOptimized);
const doSubmitWeak = () =>
  submitAndPoll("/api/question_submit/weak", submittingWeak);

const changeCode = (value: string) => {
  form.value.code = value;
};

onMounted(() => {
  loadData();
});
</script>

<style>
#viewQuestionView {
  max-width: 1400px;
  margin: 0 auto;
}
#viewQuestionView .arco-space-horizontal .arco-space-item {
  margin-bottom: 0 !important;
}
.judge-card,
.feedback-card {
  margin-top: 20px;
  padding: 0;
}
.explanation {
  margin: 8px 0;
  line-height: 1.6;
}
.hint {
  margin-top: 8px;
  color: #ff7c00;
}
.judge-metrics {
  font-size: 0.9rem;
  color: #555;
  margin: 8px 0;
}
.judge-message {
  margin-top: 5px;
}
</style>
