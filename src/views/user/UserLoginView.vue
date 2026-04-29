<template>
  <div id="userLoginView">
    <a-form :model="form" :style="{ width: '600px' }" @submit="handleSubmit">
      <a-form-item field="userAccount" label="账号">
        <a-input v-model="form.userAccount" placeholder="请输入账号" />
      </a-form-item>
      <a-form-item field="userPassword" label="密码">
        <a-input-password
          v-model="form.userPassword"
          placeholder="请输入密码"
        />
      </a-form-item>

      <a-form-item>
        <a-button html-type="submit">提交</a-button>
      </a-form-item>
    </a-form>
  </div>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { UserControllerService, UserLoginRequest } from "../../../generated";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import message from "@arco-design/web-vue/es/message";

const router = useRouter();
const store = useStore();

//获取输入的账号密码，强制转化为后端接口实参
const form = reactive({
  userAccount: "",
  userPassword: "",
} as UserLoginRequest);

const handleSubmit = async () => {
  //接受后端返回登录结果
  const res = await UserControllerService.userLoginUsingPost(form);
  //登录成功，跳转主页
  if (res.code === 0) {
    await store.dispatch("user/getLoginUser");
    router.push({
      path: "/",
      replace: true,
    });
  } else {
    message.error("登录失败" + res.message);
  }
};
</script>
