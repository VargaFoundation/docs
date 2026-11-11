import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

// The reading order of the Choregos documentation, for its llms files: overview, concepts, get started,
// then the sections in the sidebar's order.
const CHOREGOS_ORDER = [
  'choregos/index.md',
  'choregos/concepts.md',
  'choregos/get-started.md',
  'choregos/use/**',
  'choregos/build/**',
  'choregos/integrate/**',
  'choregos/cli/**',
  'choregos/host/**',
  'choregos/reference/**',
];

const config: Config = {
  title: 'Varga Foundation',
  tagline: 'Committed to open source, building the future of AI.',
  favicon: 'img/favicon.png',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://docs.varga.foundation',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'vargafoundation', // Usually your GitHub org/user name.
  projectName: 'docs', // Usually your repo name.

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Mermaid diagrams in code blocks (```mermaid), used by the Choregos pages.
  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],

  plugins: [
    [
      // llms.txt and llms-full.txt (https://llmstxt.org/) at the site's root, plus the same pair for
      // Choregos alone under /choregos/, which the Choregos instance's documentation tools read.
      'docusaurus-plugin-llms',
      {
        title: 'Varga Foundation documentation',
        description: 'Open-source data and AI projects of the Varga Foundation.',
        excludeImports: true,
        removeDuplicateHeadings: true,
        customLLMFiles: [
          {
            filename: 'choregos/llms.txt',
            includePatterns: ['choregos/**/*.md'],
            orderPatterns: CHOREGOS_ORDER,
            fullContent: false,
            title: 'Choregos',
            description: 'Governed agents: workflows carried by agents and people, under budgets and checks you can read.',
          },
          {
            filename: 'choregos/llms-full.txt',
            includePatterns: ['choregos/**/*.md'],
            orderPatterns: CHOREGOS_ORDER,
            fullContent: true,
            title: 'Choregos',
            description: 'Governed agents: workflows carried by agents and people, under budgets and checks you can read.',
          },
        ],
      },
    ],
  ],

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          // "Edit this page" opens the page's source. Choregos' pages are imported from its own
          // repository (scripts/import-choregos-docs.mjs): they are edited there, on main.
          editUrl: ({docPath}) =>
            docPath.startsWith('choregos/')
              ? `https://github.com/VargaFoundation/choregos/edit/main/docs/site/${docPath.slice('choregos/'.length)}`
              : `https://github.com/VargaFoundation/docs/edit/main/docs/${docPath}`,
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl: 'https://github.com/VargaFoundation/docs/edit/main/',
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/Image2.png',
    navbar: {
      logo: {
        alt: 'Varga Foundation Logo',
        src: 'img/Image1.png',
        height: 60,
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://varga.foundation',
          position: 'left',
          label: 'Foundation',
        },
        {
          href: 'https://github.com/vargafoundation/docs',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Intro',
              to: '/intro',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            // {
            //   label: 'Stack Overflow',
            //   href: 'https://stackoverflow.com/questions/tagged/docusaurus',
            // },
            // {
            //   label: 'Discord',
            //   href: 'https://discordapp.com/invite/docusaurus',
            // },
            {
              label: 'X',
              href: 'https://x.com/vargafoundation',
            },
          ],
        },
        {
          title: 'More',
          items: [
            // {
            //   label: 'Blog',
            //   to: '/blog',
            // },
            {
              label: 'GitHub',
              href: 'https://github.com/vargafoundation',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Varga Foundation`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
