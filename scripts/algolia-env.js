/**
 * 启动 Hexo 时把环境变量里的 Algolia 配置同步到 hexo.config.algolia，
 * 同时兼容旧变量名，避免在 `_config.yml` 中写明文。
 */
const {
  ALGOLIA_APP_ID,
  ALGOLIA_INDEX_NAME,
  ALGOLIA_API_KEY,
  ALGOLIA_SEARCH_KEY,
  ALGOLIA_ADMIN_API_KEY,
  HEXO_ALGOLIA_INDEXING_KEY
} = process.env;

const searchKey = ALGOLIA_API_KEY || ALGOLIA_SEARCH_KEY;
const adminKey = ALGOLIA_ADMIN_API_KEY || HEXO_ALGOLIA_INDEXING_KEY;

if (ALGOLIA_APP_ID || ALGOLIA_INDEX_NAME || searchKey || adminKey) {
  hexo.config.algolia = hexo.config.algolia || {};
  if (ALGOLIA_APP_ID) {
    hexo.config.algolia.applicationID = ALGOLIA_APP_ID;
    hexo.config.algolia.appId = ALGOLIA_APP_ID;
  }
  if (ALGOLIA_INDEX_NAME) hexo.config.algolia.indexName = ALGOLIA_INDEX_NAME;
  if (searchKey) hexo.config.algolia.apiKey = searchKey;
  if (adminKey) hexo.config.algolia.adminApiKey = adminKey;
}

if (!process.env.ALGOLIA_API_KEY && ALGOLIA_SEARCH_KEY) {
  process.env.ALGOLIA_API_KEY = ALGOLIA_SEARCH_KEY;
}
if (!process.env.ALGOLIA_ADMIN_API_KEY && HEXO_ALGOLIA_INDEXING_KEY) {
  process.env.ALGOLIA_ADMIN_API_KEY = HEXO_ALGOLIA_INDEXING_KEY;
}
