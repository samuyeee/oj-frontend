<template>
  <div id="viewQuestionView">
    <a-row :gutter="[24, 24]">
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
          <a-tab-pane key="comment" title="评论" disabled>评论区</a-tab-pane>
          <a-tab-pane key="answer" title="答案">暂时无法查看答案</a-tab-pane>
        </a-tabs>
      </a-col>
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
            @click="doSubmit"
            :loading="submitting"
          >
            提交代码
          </a-button>
          <a-button
            type="primary"
            style="min-width: 200px"
            @click="getFeedback"
            :loading="feedbackLoading"
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
                feedback.errorType === "无错误"
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
import { onMounted, ref, withDefaults, defineProps } from "vue";
import {
  QuestionControllerService,
  QuestionSubmitAddRequest,
  QuestionSubmitControllerService,
  QuestionVO,
} from "../../../generated";
import message from "@arco-design/web-vue/es/message";
import CodeEditor from "@/components/CodeEditor.vue";
import MdViewer from "@/components/MdViewer.vue";
import { generateFeedback } from "@/api/feedback";
import axios from "axios";

// 设置 axios 全局配置（绝对地址，解决代理问题）
axios.defaults.baseURL = "http://localhost:8121";
axios.defaults.withCredentials = true;

interface Props {
  id: string;
}

const props = withDefaults(defineProps<Props>(), {
  id: () => "",
});

const question = ref<QuestionVO>();
const submitting = ref(false);
const feedbackLoading = ref(false);
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

/**
 * 安全解析 judgeInfo
 */
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

/**
 * 提交代码，自动轮询判题结果和 DeepSeek 反馈
 */
const doSubmit = async () => {
  if (!question.value?.id) return;

  // 重置状态
  judgeResult.value = null;
  judgeInfo.value = {};
  feedback.value = null;
  if (pollTimer) clearInterval(pollTimer);

  submitting.value = true;
  try {
    const res = await QuestionSubmitControllerService.doQuestionSubmitUsingPost(
      {
        ...form.value,
        questionId: question.value.id,
      }
    );
    if (res.code !== 0) {
      message.error("提交失败，" + res.message);
      submitting.value = false;
      return;
    }
    const submitId = res.data;
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
          console.error("DeepSeek 轮询错误", err);
        }
      }

      if (hasJudge && hasFeedback) {
        clearInterval(pollTimer!);
        submitting.value = false;
        message.success("分析完成");
      }
    }, 2000);

    // 60秒超时
    setTimeout(() => {
      if (pollTimer) {
        clearInterval(pollTimer);
        submitting.value = false;
        if (!hasJudge) message.warning("判题超时，请稍后刷新页面查看");
        if (!hasFeedback) message.warning("AI 分析超时");
      }
    }, 60000);
  } catch (error: any) {
    console.error(error);
    message.error("提交失败，" + error.message);
    submitting.value = false;
  }
};

/**
 * 单独获取 DeepSeek 反馈
 */
const getFeedback = async () => {
  if (!form.value.code?.trim()) {
    message.warning("请先编写代码");
    return;
  }
  feedbackLoading.value = true;
  feedback.value = null;
  try {
    const response = await generateFeedback({
      code: form.value.code,
      language: form.value.language,
      questionDescription: question.value?.content || "",
    });
    feedback.value = response.data;
    message.success("反馈生成成功");
  } catch (error) {
    console.error(error);
    message.error("获取反馈失败，请稍后重试");
  } finally {
    feedbackLoading.value = false;
  }
};

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
