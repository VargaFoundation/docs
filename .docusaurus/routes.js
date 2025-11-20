import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/__docusaurus/debug',
    component: ComponentCreator('/__docusaurus/debug', '5ff'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/config',
    component: ComponentCreator('/__docusaurus/debug/config', '5ba'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/content',
    component: ComponentCreator('/__docusaurus/debug/content', 'a2b'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/globalData',
    component: ComponentCreator('/__docusaurus/debug/globalData', 'c3c'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/metadata',
    component: ComponentCreator('/__docusaurus/debug/metadata', '156'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/registry',
    component: ComponentCreator('/__docusaurus/debug/registry', '88c'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/routes',
    component: ComponentCreator('/__docusaurus/debug/routes', '000'),
    exact: true
  },
  {
    path: '/blog',
    component: ComponentCreator('/blog', 'b2f'),
    exact: true
  },
  {
    path: '/blog/archive',
    component: ComponentCreator('/blog/archive', '182'),
    exact: true
  },
  {
    path: '/blog/authors',
    component: ComponentCreator('/blog/authors', '0b7'),
    exact: true
  },
  {
    path: '/blog/authors/all-sebastien-lorber-articles',
    component: ComponentCreator('/blog/authors/all-sebastien-lorber-articles', '4a1'),
    exact: true
  },
  {
    path: '/blog/authors/yangshun',
    component: ComponentCreator('/blog/authors/yangshun', 'a68'),
    exact: true
  },
  {
    path: '/blog/first-blog-post',
    component: ComponentCreator('/blog/first-blog-post', '89a'),
    exact: true
  },
  {
    path: '/blog/long-blog-post',
    component: ComponentCreator('/blog/long-blog-post', '9ad'),
    exact: true
  },
  {
    path: '/blog/mdx-blog-post',
    component: ComponentCreator('/blog/mdx-blog-post', 'e9f'),
    exact: true
  },
  {
    path: '/blog/tags',
    component: ComponentCreator('/blog/tags', '287'),
    exact: true
  },
  {
    path: '/blog/tags/docusaurus',
    component: ComponentCreator('/blog/tags/docusaurus', '704'),
    exact: true
  },
  {
    path: '/blog/tags/facebook',
    component: ComponentCreator('/blog/tags/facebook', '858'),
    exact: true
  },
  {
    path: '/blog/tags/hello',
    component: ComponentCreator('/blog/tags/hello', '299'),
    exact: true
  },
  {
    path: '/blog/tags/hola',
    component: ComponentCreator('/blog/tags/hola', '00d'),
    exact: true
  },
  {
    path: '/blog/welcome',
    component: ComponentCreator('/blog/welcome', 'd2b'),
    exact: true
  },
  {
    path: '/markdown-page',
    component: ComponentCreator('/markdown-page', '3d7'),
    exact: true
  },
  {
    path: '/',
    component: ComponentCreator('/', 'e5f'),
    exact: true
  },
  {
    path: '/',
    component: ComponentCreator('/', 'cf6'),
    routes: [
      {
        path: '/',
        component: ComponentCreator('/', '769'),
        routes: [
          {
            path: '/',
            component: ComponentCreator('/', 'a6d'),
            routes: [
              {
                path: '/category/nexberos',
                component: ComponentCreator('/category/nexberos', 'd2e'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/category/rivio',
                component: ComponentCreator('/category/rivio', '63d'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/category/vorath',
                component: ComponentCreator('/category/vorath', '3da'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/category/weave',
                component: ComponentCreator('/category/weave', '2db'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/intro',
                component: ComponentCreator('/intro', '9fa'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/nexberos/',
                component: ComponentCreator('/nexberos/', 'd97'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/rivio/',
                component: ComponentCreator('/rivio/', '40e'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/vorath/',
                component: ComponentCreator('/vorath/', '2f3'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/vorath/compatibility',
                component: ComponentCreator('/vorath/compatibility', 'c13'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/vorath/configuration',
                component: ComponentCreator('/vorath/configuration', 'ffb'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/vorath/examples',
                component: ComponentCreator('/vorath/examples', '258'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/vorath/faq',
                component: ComponentCreator('/vorath/faq', 'e15'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/vorath/installation-deployment',
                component: ComponentCreator('/vorath/installation-deployment', '742'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/vorath/operations',
                component: ComponentCreator('/vorath/operations', 'dd5'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/vorath/prerequisites-resources',
                component: ComponentCreator('/vorath/prerequisites-resources', 'f46'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/vorath/security',
                component: ComponentCreator('/vorath/security', '0e2'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/vorath/troubleshooting',
                component: ComponentCreator('/vorath/troubleshooting', '56e'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/weave/',
                component: ComponentCreator('/weave/', '183'),
                exact: true,
                sidebar: "tutorialSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
