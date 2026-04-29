<template>
  <a-row id="gloablHeader" align="center" :wrap="false">
    <a-col flex="auto">
      <a-menu
        mode="horizontal"
        :selected-keys="selectedKeys"
        @menu-item-click="doMenuClick"
      >
        <a-menu-item
          key="0"
          :style="{ padding: 0, marginRight: '38px' }"
          disabled
        >
          <div class="title-bar">
            <img class="logo" src="../assets/oj-logo.png" />
            <div class="title">Onlie Judge</div>
          </div>
        </a-menu-item>
        <a-menu-item v-for="item in visibleRoutes" :key="item.path">
          {{ item.name }}
        </a-menu-item>
      </a-menu>
    </a-col>
    <!--右侧!-->
    <a-col flex="100px">
      <div>{{ store.state.user?.loginUser?.userName ?? "未登录" }}</div>
    </a-col>
  </a-row>
</template>

<script setup lang="ts">
import { routes } from "@/router/routes";
import { useRoute, useRouter } from "vue-router";
import { computed, ref } from "vue";
import { useStore } from "vuex";
import ACCESS_ENUM from "@/access/accessEnum";
import checkAccess from "@/access/checkAccess";

const router = useRouter();
//获取用户信息
const store = useStore();

// 展示在菜单的路由数组
const visibleRoutes = computed(() => {
  return routes.filter((item, index) => {
    if (item.meta?.hideInMenu) {
      return false;
    }
    //根据权限过滤菜单
    if (
      !checkAccess(store.state.user.loginUser, item?.meta?.access as string)
    ) {
      return false;
    }
    return true;
  });
});

// 默认主页
const selectedKeys = ref(["/"]);

//跳转页面
const doMenuClick = (key: string) => {
  router.push({ path: key });
};

// 路由跳转后，得到跳转后的路径，更新选中的菜单项
router.afterEach((to: { path: string }, from: any, failure: any) => {
  selectedKeys.value = [to.path];
});

//3秒后自动登录
setTimeout(() => {
  store.dispatch("user/getLoginUser", {
    userName: "OnlieJudge",
    userRole: ACCESS_ENUM.ADMIN,
  });
}, 3000);
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
#gloablHeader {
}

.title-bar {
  display: flex;
  align-items: center;
}
.title {
  color: #444;
  margin-left: 16px;
}
.logo {
  height: 48px;
}
</style>
