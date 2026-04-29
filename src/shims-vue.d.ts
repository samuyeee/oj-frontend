/* eslint-disable */
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// 添加 ArcoVue 声明
declare module "@arco-design/web-vue" {
  import { Plugin } from "vue";
  const ArcoVue: Plugin;
  export default ArcoVue;
}

declare module "vue-router";
