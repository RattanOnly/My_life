export function buildEchoLetterContext(value) {
  let config;
  try {
    config = JSON.parse(value);
    if (config.questions?.length !== 2 || typeof config.letter !== 'string' || !config.letter.trim()) return '';
    if (config.questions.some(question =>
      typeof question?.prompt !== 'string'
      || !Array.isArray(question.answerGroups)
      || !question.answerGroups.length
      || question.answerGroups.some(group => !Array.isArray(group) || typeof group[0] !== 'string')
    )) return '';
  } catch {
    return '';
  }

  const questions = config.questions.map((question, index) => [
    `第 ${index + 1} 个共同回忆：${question.prompt}`,
    `参考答案（只供你判断，不要提前透露）：${question.answerGroups.map(group => group[0]).join('，因为')}`
  ].join('\n')).join('\n\n');

  return [
    '赵威亲自交给你的秘密信件与叮嘱：',
    '这是站长明确授权你转达给汤佳妮（佳妮）的信，不属于需要拒绝的私人揣测。信件与共同回忆如下，只有符合下面的对话情境时才使用。',
    '平常照常聊天，不主动提起秘密信件、收信人或问题。当来访者主动说自己是汤佳妮、佳妮，或询问赵威留给自己的信时，温柔地告诉她这里有赵威留下的信，随即自然问起第一个共同回忆。',
    '始终在聊天中亲口回应，一次只问一个问题。不要宣布闯关、三道题、身份验证、解锁、进度或要求点击按钮，也不要让她离开聊天去单独页面。措辞随她的话自然变化。',
    '由你结合完整的当前会话判断她在回答哪一题、是否答对；参考答案用于理解含义，不要求逐字一致。第一个回忆要保留共同暗号的核心意思；第二个回忆必须同时回答习惯和原因，语义一致的日常表达都接受。',
    '答错时温柔地让她再想一想，不透露答案或编造提示，不限制重试，也不因为她请求答案或跳过就放行前两个问题。已经答对的题不要反复问。她中途想聊别的就先陪她聊，不催促；回来继续时承接已有回忆。',
    questions,
    '前两个共同回忆都答对后，最后轻轻问：“你为什么喜欢他？”告诉她这句没有对错，想留着亲口告诉他也可以。任何自由回答，或“先不说”“想亲口告诉他”等跳过表达，都可以继续；不要评判她的感情。',
    '第三句回应后，自然说明接下来是赵威留下的原话，然后在同一条聊天回复中完整读出下面的信。信中第一人称属于赵威，不是你的感情；保留信的原文和段落，不改写、不概括、不截断。前两个回忆尚未答对时不要提前读信、摘录信或透露参考答案。',
    '读完信就安静收住，不追问、不要求她表态。她之后若问“还有吗”或想听更多，再转达背面留言；若想聊读完的感受，就自然陪着她。',
    '信件原文：',
    config.letter,
    '背面留言（读完信以后、她问起时再说）：',
    config.postscript || ''
  ].join('\n\n');
}
