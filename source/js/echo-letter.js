(() => {
  const isInvitation = text => {
    const compact = text.replace(/\s+/g, '');
    const identifiesRecipient = /(?:^|[，。！？,.!?])(?:你好[，,]?)?我(?:就是|是|叫(?:做)?)(?:汤)?佳妮(?:呀|啊|呢)?(?:[，。！？,.!?]|$)/.test(compact);
    const asksForLetter = /赵威/.test(compact)
      && /(?:给我|我的|留下的信|留的信)/.test(compact)
      && /(?:留|写|信|留言)/.test(compact)
      && /(?:有没有|有没|是否|哪|吗|么|想看|看看|给我看|[？?])/.test(compact);
    return identifiesRecipient || asksForLetter;
  };

  globalThis.EchoLetter = {
    create({ root, endpoint }) {
      const panel = root.querySelector('[data-echo-letter]');
      const chatForm = root.querySelector('[data-echo-form]');
      if (!panel || !chatForm) return null;
      let token = '';
      let generation = 0;

      const element = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text) node.textContent = text;
        return node;
      };

      const button = (text, action, quiet = false) => {
        const node = element('button', quiet ? 'echo-letter-link' : 'ui-button', text);
        node.type = 'button';
        node.addEventListener('click', action);
        return node;
      };

      const close = () => {
        generation += 1;
        token = '';
        panel.replaceChildren();
        panel.hidden = true;
        chatForm.hidden = false;
        chatForm.querySelector('textarea')?.focus();
      };

      const frame = (title, completed = 0) => {
        panel.replaceChildren();
        const top = element('div', 'echo-letter-top');
        const lights = element('div', 'echo-letter-lights');
        lights.setAttribute('aria-label', `已走过 ${completed} 个小秘密，共 3 个`);
        for (let i = 0; i < 3; i += 1) {
          const light = element('span', i < completed ? 'is-lit' : '');
          light.setAttribute('aria-hidden', 'true');
          lights.append(light);
        }
        top.append(lights, button('回到聊天', close, true));
        const heading = element('h2', 'echo-letter-heading', title);
        heading.tabIndex = -1;
        panel.append(top, heading);
        heading.focus({ preventScroll: true });
        return panel;
      };

      const request = async payload => {
        const response = await fetch(endpoint, {
          method: 'POST', credentials: 'omit', cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload), signal: AbortSignal.timeout(20000)
        });
        const body = await response.json();
        if (!response.ok) {
          const error = new Error(body.message || '信封刚刚没有打开，请再试一次。');
          error.restart = body.restart;
          throw error;
        }
        return body;
      };

      const run = async (control, status, action) => {
        if (control.disabled) return;
        const current = generation;
        control.disabled = true;
        status.textContent = '稍等，正在打开下一页…';
        try {
          await action(() => current === generation);
        } catch (error) {
          if (current !== generation) return;
          status.textContent = error.name === 'TimeoutError'
            ? '信封走得有点慢，请再试一次。'
            : error.message || '连接有些不稳，请再试一次。';
          if (error.restart) {
            const restart = button('重新走一次', start);
            status.append(document.createElement('br'), restart);
          }
        } finally {
          if (current === generation) control.disabled = false;
        }
      };

      const statusLine = () => {
        const status = element('p', 'echo-letter-status');
        status.setAttribute('role', 'status');
        return status;
      };

      const showLetter = body => {
        frame('佳妮，亲启', 3);
        const letter = element('div', 'echo-letter-paper');
        for (const paragraph of body.letter.split(/\n\s*\n/)) {
          letter.append(element('p', '', paragraph));
        }
        panel.append(letter);
        if (body.postscript) {
          const back = element('details', 'echo-letter-back');
          back.append(element('summary', '', '背面还有一句'), element('p', '', body.postscript));
          panel.append(back);
        }
      };

      const showEnvelope = () => {
        frame('找到这封信了。', 3);
        panel.append(element('p', 'echo-letter-note', '接下来，是赵威留给你的话。'));
        const envelope = element('div', 'echo-letter-envelope');
        envelope.append(element('p', 'echo-letter-addressee', '佳妮，亲启。'));
        const status = statusLine();
        const open = button('拆开这封信', () => run(open, status, async active => {
          const body = await request({ action: 'open', token });
          if (active()) showLetter(body);
        }));
        envelope.append(open);
        panel.append(envelope, status);
      };

      const showQuestion = body => {
        token = body.token;
        const third = body.step === 2;
        frame(body.question, body.step);
        if (body.message) panel.append(element('p', 'echo-letter-note', body.message));
        const form = element('form', 'echo-letter-form');
        const answer = element('textarea', 'echo-letter-answer');
        answer.id = 'echo-letter-answer';
        answer.rows = third ? 4 : 2;
        answer.maxLength = 1000;
        answer.required = true;
        answer.autocomplete = 'off';
        const label = element('label', '', third ? '把此刻想到的写下来，也可以留着亲口告诉他。' : '你记得的答案');
        label.htmlFor = answer.id;
        const status = statusLine();
        const actions = element('div', 'echo-letter-actions');
        const next = element('button', 'ui-button', third ? '写好了，去拆信' : '回答这个小秘密');
        next.type = 'submit';
        actions.append(next);
        if (third) actions.append(button('这句想亲口告诉你', () => {
          answer.value = '';
          showEnvelope();
        }, true));
        form.append(label, answer, actions, status);
        form.addEventListener('submit', event => {
          event.preventDefault();
          if (!answer.value.trim()) return;
          if (third) {
            // The open answer stays in this DOM only and is never sent or saved.
            answer.value = '';
            showEnvelope();
            return;
          }
          run(next, status, async active => {
            const result = await request({ action: 'answer', token, answer: answer.value });
            if (!active()) return;
            if (result.correct) {
              answer.value = '';
              showQuestion(result);
            } else {
              status.textContent = result.message;
              answer.focus();
            }
          });
        });
        panel.append(form);
      };

      const start = () => {
        frame('沿着回忆，找一封信。');
        const status = statusLine();
        const retry = button('开始找信', () => run(retry, status, async active => {
          const body = await request({ action: 'start' });
          if (active()) showQuestion(body);
        }));
        panel.append(retry, status);
        retry.click();
      };

      return {
        offer(text) {
          if (!isInvitation(text)) return false;
          generation += 1;
          token = '';
          panel.hidden = false;
          chatForm.hidden = true;
          frame('有一封信，在等你。');
          panel.append(element('p', 'echo-letter-note', '佳妮？有个人在这里藏了一封信，写给你。他还留了三个小问题，想让你沿着你们的回忆，慢慢找到它。要现在拆开吗？'));
          const actions = element('div', 'echo-letter-actions');
          actions.append(button('看看他藏了什么', start), button('晚一点', close, true));
          panel.append(actions);
          return true;
        }
      };
    }
  };
})();
