import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'
import ProjectConfigTest from '@/views/ProjectConfigTest.vue'
import MyCharts from '@/views/MyCharts.vue'
import ChartDetail from '@/views/ChartDetail.vue'
import ChartNavigationDemo from '@/views/ChartNavigationDemo.vue'
import ThemeDemo from '@/views/ThemeDemo.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: {
      title: '智能图表生成系统 - 创建图表'
    }
  },
  {
    path: '/my-charts',
    name: 'MyCharts',
    component: MyCharts,
    meta: {
      title: '我的图表'
    }
  },
  {
    path: '/chart/:id',
    name: 'ChartDetail',
    component: ChartDetail,
    meta: {
      title: '图表详情'
    }
  },
  {
    path: '/project-config',
    name: 'ProjectConfig',
    component: ProjectConfigTest,
    meta: {
      title: '项目配置测试'
    }
  },
  {
    path: '/navigation-demo',
    name: 'ChartNavigationDemo',
    component: ChartNavigationDemo,
    meta: {
      title: '图表导航演示'
    }
  },
  {
    path: '/theme-demo',
    name: 'ThemeDemo',
    component: ThemeDemo,
    meta: {
      title: '主题系统演示'
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  if (to.meta.title) {
    document.title = to.meta.title
  }
  next()
})

export default router
