import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Language = 'en' | 'zh'

const en = {
  nav: { studio: 'Studio', developers: 'Developers', pricing: 'Pricing', dashboard: 'Dashboard', language: 'Language' },
  wallet: {
    connect: 'Connect wallet',
    connecting: 'Connecting…',
    restoring: 'Restoring…',
    logout: 'Log out',
    noWallet: 'No browser wallet found. Install MetaMask, Rabby, or another EIP-1193 wallet.',
    noAccount: 'Wallet did not return an account.',
    rejected: 'The request was cancelled in your wallet.',
  },
  home: {
    eyebrow: 'Open avatar layer for Ethereum wallets',
    title: 'One avatar for every wallet, everywhere.',
    lead: 'Publish a profile picture to your wallet address in one gasless signature. Any app can show it with a single image URL.',
    ctaStudio: 'Set your avatar',
    ctaDevelopers: 'Add avatars to your app',
    lookupTitle: 'Look up any wallet',
    lookupPlaceholder: '0x… address or name.eth',
    lookupButton: 'View',
    lookupInvalid: 'Enter a 0x address (40 hex characters) or an ENS name.',
    featuresTitle: 'Why Wallet Face',
    features: [
      { title: 'Gasless', body: 'Publishing is a signed Snapshot profile message. No transaction, no fees.' },
      { title: 'Yours', body: 'Keys stay in your wallet. Images live on IPFS. Nothing is locked to this site.' },
      { title: 'Works everywhere', body: 'Snapshot, Stamp and ENS-aware apps already read it. Everyone else can use our API.' },
      { title: 'Built for developers', body: 'Image URLs, JSON lookups, batch requests, gateway fallback and edge caching.' },
    ],
    howTitle: 'How it works',
    how: [
      'Connect your wallet. Your private key never leaves it.',
      'Pick an image. It is cropped to a square and compressed in your browser.',
      'Sign once. The image goes to IPFS and your profile is published to Snapshot.',
      'Show it anywhere: every app can load it from your address.',
    ],
  },
  studio: {
    title: 'Avatar studio',
    connectFirst: 'Connect a wallet to publish your avatar.',
    current: 'Current avatar',
    none: 'No avatar published yet.',
    choose: 'Choose image',
    chooseAnother: 'Choose another image',
    dropHint: 'JPG, PNG, WebP or GIF up to 15 MB. It is cropped and compressed before upload.',
    zoom: 'Zoom',
    publish: 'Publish avatar',
    uploading: 'Uploading image to IPFS…',
    signing: 'Sign the profile update in your wallet. This costs no gas.',
    publishing: 'Publishing to Snapshot…',
    published: 'Your avatar is live. Apps may take a few minutes to refresh their caches.',
    viewProfile: 'View public profile',
    ensTitle: 'Optional: also write it to ENS',
    ensBody: 'Apps that only read ENS will show it too. This is a mainnet transaction and costs gas.',
    ensButton: 'Write ENS avatar record',
    ensWorking: 'Waiting for the ENS transaction…',
    ensDoneAddress: 'ENS avatar written to your address record.',
    ensDoneName: (name: string) => `ENS avatar written for ${name}.`,
    ensMissing: 'This wallet has no ENS name or resolver, so there is nothing to update.',
    invalidType: 'Choose a JPG, PNG, WebP or GIF image.',
    tooLarge: 'That file is larger than 15 MB.',
    unreadable: 'That image could not be read. Try another file.',
  },
  profile: {
    title: 'Wallet profile',
    loading: 'Looking up avatar…',
    notFound: 'No avatar has been published for this wallet yet.',
    invalid: 'That is not a valid address or ENS name.',
    source: 'Source',
    sourceSnapshot: 'Snapshot profile',
    sourceEns: 'ENS text record',
    uri: 'Content URI',
    embedTitle: 'Use this avatar',
    imageLink: 'Image URL',
    jsonLink: 'JSON API',
    htmlEmbed: 'HTML',
    copy: 'Copy',
    copied: 'Copied',
    open: 'Open',
    yours: 'This is your wallet.',
    edit: 'Change avatar',
    offline: 'The avatar API is unreachable; showing data read directly from Snapshot.',
  },
  developers: {
    title: 'Wallet avatars for your app',
    lead: 'Show the avatar of any Ethereum address with one URL. Add a key when you need JSON, batch lookups and higher limits.',
    quickTitle: '1. Drop in an image',
    quickBody: 'No key, no SDK. Wallets without an avatar get a unique identicon, or a 404 if you prefer.',
    jsonTitle: '2. Fetch JSON',
    jsonBody: 'Resolve an address or ENS name to its avatar URI, gateway URLs and source.',
    batchTitle: '3. Batch with an API key',
    batchBody: 'Resolve many addresses in one call, for example a list of voters or holders. Create a free key in the dashboard.',
    sdkTitle: 'JavaScript SDK',
    sdkBody: 'A tiny dependency-free client lives in the repository under sdk/.',
    refTitle: 'Reference',
    params: [
      ['s', 'Image size hint for identicons, 16–1024 (default 256).'],
      ['fallback', '`identicon` (default) or `404` when there is no avatar.'],
      ['X-API-Key', 'Header with your key. Bearer authorization also works.'],
    ] as Array<[string, string]>,
    limitsTitle: 'Limits',
    limits: [
      'Images are cached at the edge and are not counted against your quota.',
      'Anonymous JSON lookups are rate-limited per IP.',
      'Keyed requests count toward your monthly plan quota; each batch address counts as one request.',
      'Responses include X-RateLimit-Limit and X-RateLimit-Remaining headers.',
    ],
    errorsTitle: 'Errors',
    errorsBody: 'Errors use HTTP status codes and a JSON body: { "error": { "code", "message" } }.',
    keepSecret: 'Keep API keys on your server. Image URLs never need one.',
    getKey: 'Get a free API key',
  },
  pricing: {
    title: 'Simple pricing',
    lead: 'Publishing your own avatar is always free. Plans are for apps that resolve avatars at scale.',
    perMonth: '/ month',
    requests: (n: string) => `${n} API requests / month`,
    batch: (n: number) => `Batch up to ${n} addresses`,
    extras: {
      free: ['Image + JSON endpoints', 'Community support'],
      pro: ['Email support', 'Usage dashboard'],
      business: ['Priority support', 'White-label deployment help'],
    } as Record<string, string[]>,
    free: 'Start free',
    upgrade: 'Upgrade',
    current: 'Current plan',
    contact: 'Contact us',
    billingOff: 'Online checkout is not enabled yet. Contact us and we will set up your plan.',
    cancelled: 'Checkout was cancelled. You have not been charged.',
    faqTitle: 'Questions',
    faq: [
      ['Do my users pay anything?', 'No. Publishing an avatar is a free, gasless signature. Writing to ENS is optional and paid in gas to the network, not to us.'],
      ['What counts as a request?', 'Each keyed JSON lookup, and each address inside a batch. Image URLs are cached and free.'],
      ['Can I cancel?', 'Yes, at any time from the billing portal. You return to the Free plan at the end of the period.'],
      ['Do you hold any keys or funds?', 'No. Sign-in is a wallet signature, and payments are processed by Stripe.'],
    ] as Array<[string, string]>,
  },
  dashboard: {
    title: 'Developer dashboard',
    connectFirst: 'Connect the wallet that will own your API keys.',
    signInTitle: 'Sign in with your wallet',
    signInBody: 'Sign a one-time message to prove you own this wallet. No transaction, no gas.',
    signIn: 'Sign in',
    signingIn: 'Waiting for signature…',
    signOut: 'Sign out',
    plan: 'Plan',
    usage: 'Usage this month',
    of: 'of',
    history: 'Recent months',
    apiKey: 'API key',
    noKey: 'You do not have an API key yet.',
    createKey: 'Create API key',
    rotateKey: 'Rotate key',
    rotateConfirm: 'Rotating revokes your current key immediately. Continue?',
    newKey: 'Copy your new key now. It will not be shown again.',
    keyCreated: (date: string) => `Created ${date}`,
    billing: 'Billing',
    upgrade: 'See plans',
    manage: 'Manage subscription',
    renews: (date: string) => `Current period ends ${date}`,
    status: 'Status',
    checkoutSuccess: 'Thanks! Your subscription is active. It can take a few seconds to appear here.',
    apiDown: 'The API could not be reached. Check your connection or try again later.',
    sessionExpired: 'Your session expired. Please sign in again.',
  },
  footer: {
    tagline: 'Open source, MIT licensed. Keys stay in your wallet.',
    source: 'Source on GitHub',
    status: 'API status',
  },
  common: { working: 'Working…', retry: 'Try again', close: 'Close' },
}

type Dictionary = typeof en

const zh: Dictionary = {
  nav: { studio: '头像工作室', developers: '开发者', pricing: '价格', dashboard: '控制台', language: '界面语言' },
  wallet: {
    connect: '连接钱包',
    connecting: '连接中…',
    restoring: '恢复中…',
    logout: '退出',
    noWallet: '未找到浏览器钱包，请安装 MetaMask、Rabby 或其他 EIP-1193 钱包。',
    noAccount: '钱包没有返回账户。',
    rejected: '你在钱包中取消了请求。',
  },
  home: {
    eyebrow: '面向以太坊钱包的开放头像层',
    title: '一个头像，所有应用通用。',
    lead: '一次免 Gas 签名，把头像绑定到你的钱包地址。任何应用只需一个图片链接即可显示。',
    ctaStudio: '设置我的头像',
    ctaDevelopers: '为我的应用接入头像',
    lookupTitle: '查询任意钱包',
    lookupPlaceholder: '0x… 地址或 name.eth',
    lookupButton: '查看',
    lookupInvalid: '请输入 0x 地址（40 位十六进制）或 ENS 名称。',
    featuresTitle: '为什么选择 Wallet Face',
    features: [
      { title: '免 Gas', body: '发布只是一条签名的 Snapshot 资料消息，没有交易，也没有手续费。' },
      { title: '属于你', body: '私钥留在钱包，图片存于 IPFS，不被本网站锁定。' },
      { title: '处处可用', body: 'Snapshot、Stamp 和支持 ENS 的应用已可读取；其他应用可使用我们的 API。' },
      { title: '为开发者打造', body: '图片链接、JSON 查询、批量请求、网关回退与边缘缓存。' },
    ],
    howTitle: '工作原理',
    how: [
      '连接钱包，私钥始终不离开钱包。',
      '选择图片，在浏览器中自动裁剪为正方形并压缩。',
      '签名一次，图片上传至 IPFS，资料发布到 Snapshot。',
      '随处显示：任何应用都能通过你的地址加载头像。',
    ],
  },
  studio: {
    title: '头像工作室',
    connectFirst: '连接钱包后即可发布头像。',
    current: '当前头像',
    none: '还没有发布头像。',
    choose: '选择图片',
    chooseAnother: '更换图片',
    dropHint: '支持 JPG、PNG、WebP、GIF，最大 15 MB，上传前会自动裁剪和压缩。',
    zoom: '缩放',
    publish: '发布头像',
    uploading: '正在上传图片到 IPFS…',
    signing: '请在钱包中签署资料更新，不消耗 Gas。',
    publishing: '正在发布到 Snapshot…',
    published: '头像已上线。各应用刷新缓存可能需要几分钟。',
    viewProfile: '查看公开主页',
    ensTitle: '可选：同时写入 ENS',
    ensBody: '只读取 ENS 的应用也能显示。这是一笔主网交易，需要支付 Gas。',
    ensButton: '写入 ENS 头像记录',
    ensWorking: '等待 ENS 交易确认…',
    ensDoneAddress: 'ENS 头像已写入你的地址记录。',
    ensDoneName: (name: string) => `已为 ${name} 写入 ENS 头像。`,
    ensMissing: '该钱包没有 ENS 名称或解析器，无需更新。',
    invalidType: '请选择 JPG、PNG、WebP 或 GIF 图片。',
    tooLarge: '文件超过 15 MB。',
    unreadable: '无法读取这张图片，请换一个文件。',
  },
  profile: {
    title: '钱包主页',
    loading: '正在查询头像…',
    notFound: '该钱包还没有发布头像。',
    invalid: '这不是有效的地址或 ENS 名称。',
    source: '来源',
    sourceSnapshot: 'Snapshot 资料',
    sourceEns: 'ENS 文本记录',
    uri: '内容 URI',
    embedTitle: '使用这个头像',
    imageLink: '图片链接',
    jsonLink: 'JSON 接口',
    htmlEmbed: 'HTML',
    copy: '复制',
    copied: '已复制',
    open: '打开',
    yours: '这是你的钱包。',
    edit: '更换头像',
    offline: '头像 API 暂时无法访问，以下数据直接读取自 Snapshot。',
  },
  developers: {
    title: '为你的应用接入钱包头像',
    lead: '一个链接即可显示任意以太坊地址的头像。需要 JSON、批量查询和更高额度时再添加密钥。',
    quickTitle: '1. 直接放一张图片',
    quickBody: '无需密钥或 SDK。没有头像的钱包会显示独特的生成图案，也可以选择返回 404。',
    jsonTitle: '2. 获取 JSON',
    jsonBody: '把地址或 ENS 名称解析为头像 URI、网关链接和来源。',
    batchTitle: '3. 使用 API 密钥批量查询',
    batchBody: '一次请求解析多个地址，例如投票者或持有者列表。在控制台免费创建密钥。',
    sdkTitle: 'JavaScript SDK',
    sdkBody: '仓库 sdk/ 目录中提供一个无依赖的小型客户端。',
    refTitle: '参数说明',
    params: [
      ['s', '生成图案的尺寸提示，16–1024（默认 256）。'],
      ['fallback', '没有头像时返回 `identicon`（默认）或 `404`。'],
      ['X-API-Key', '携带密钥的请求头，也支持 Bearer 授权。'],
    ],
    limitsTitle: '额度',
    limits: [
      '图片在边缘节点缓存，不计入额度。',
      '匿名 JSON 查询按 IP 限速。',
      '带密钥的请求计入每月额度；批量中的每个地址计为一次请求。',
      '响应包含 X-RateLimit-Limit 与 X-RateLimit-Remaining 头。',
    ],
    errorsTitle: '错误',
    errorsBody: '错误使用 HTTP 状态码，并返回 JSON：{ "error": { "code", "message" } }。',
    keepSecret: '请把 API 密钥保存在服务器端，图片链接无需密钥。',
    getKey: '免费获取 API 密钥',
  },
  pricing: {
    title: '简单透明的价格',
    lead: '发布自己的头像永久免费。付费方案面向需要大规模解析头像的应用。',
    perMonth: '/ 月',
    requests: (n: string) => `每月 ${n} 次 API 请求`,
    batch: (n: number) => `单次批量最多 ${n} 个地址`,
    extras: {
      free: ['图片与 JSON 接口', '社区支持'],
      pro: ['邮件支持', '用量控制台'],
      business: ['优先支持', '白标部署协助'],
    },
    free: '免费开始',
    upgrade: '升级',
    current: '当前方案',
    contact: '联系我们',
    billingOff: '在线支付尚未开通。请联系我们为你开通方案。',
    cancelled: '已取消结账，未产生任何费用。',
    faqTitle: '常见问题',
    faq: [
      ['我的用户需要付费吗？', '不需要。发布头像是一次免费、免 Gas 的签名。写入 ENS 是可选的，Gas 支付给网络而不是我们。'],
      ['什么算一次请求？', '每次带密钥的 JSON 查询，以及批量中的每个地址。图片链接有缓存且免费。'],
      ['可以随时取消吗？', '可以，在账单门户中随时取消，周期结束后回到免费方案。'],
      ['你们会托管密钥或资金吗？', '不会。登录只是钱包签名，付款由 Stripe 处理。'],
    ],
  },
  dashboard: {
    title: '开发者控制台',
    connectFirst: '请连接用于管理 API 密钥的钱包。',
    signInTitle: '使用钱包登录',
    signInBody: '签署一条一次性消息以证明你拥有该钱包。没有交易，不消耗 Gas。',
    signIn: '登录',
    signingIn: '等待签名…',
    signOut: '退出登录',
    plan: '方案',
    usage: '本月用量',
    of: '/',
    history: '最近几个月',
    apiKey: 'API 密钥',
    noKey: '你还没有 API 密钥。',
    createKey: '创建 API 密钥',
    rotateKey: '轮换密钥',
    rotateConfirm: '轮换会立即作废当前密钥，是否继续？',
    newKey: '请立即复制新密钥，之后将不再显示。',
    keyCreated: (date: string) => `创建于 ${date}`,
    billing: '账单',
    upgrade: '查看方案',
    manage: '管理订阅',
    renews: (date: string) => `当前周期结束于 ${date}`,
    status: '状态',
    checkoutSuccess: '感谢订阅！订阅已生效，可能需要几秒钟才会显示。',
    apiDown: '无法连接 API，请检查网络或稍后再试。',
    sessionExpired: '登录已过期，请重新登录。',
  },
  footer: {
    tagline: '开源，MIT 许可。私钥始终留在你的钱包。',
    source: 'GitHub 源码',
    status: 'API 状态',
  },
  common: { working: '处理中…', retry: '重试', close: '关闭' },
}

const dictionaries: Record<Language, Dictionary> = { en, zh }
const storageKey = 'wallet-face-language'

function detectLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(storageKey)
    if (saved === 'zh' || saved === 'en') return saved
  } catch {
    // Storage may be unavailable (private mode); fall back to the browser.
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

const I18nContext = createContext<{ language: Language; t: Dictionary; setLanguage(value: Language): void } | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(detectLanguage)
  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
    try {
      window.localStorage.setItem(storageKey, language)
    } catch {
      // Language still switches for this visit.
    }
  }, [language])
  return (
    <I18nContext.Provider value={{ language, t: dictionaries[language], setLanguage }}>{children}</I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used inside I18nProvider')
  return context
}

/** Map known wallet/library errors to friendly, translated text. */
export function friendlyError(cause: unknown, t: Dictionary) {
  const raw = cause instanceof Error ? cause.message : String(cause)
  if (/user (rejected|denied)|rejected the request|4001/i.test(raw)) return t.wallet.rejected
  if (raw.startsWith('No browser wallet found')) return t.wallet.noWallet
  if (raw === 'Wallet did not return an account.') return t.wallet.noAccount
  return raw.split('\n')[0].slice(0, 300)
}
