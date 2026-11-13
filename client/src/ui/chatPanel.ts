// Chat panel (step 5): a scrollable chat log and a chat input (max CHAT_MAX_LENGTH characters).
// Enter sends; Escape leaves the input. Chat is public inside the room you are in.

import { CHAT_LOG_MAX, CHAT_MAX_LENGTH, type ChatLine } from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';

export interface ChatPanel {
  readonly el: HTMLElement;
  add(line: ChatLine): void;
  clear(): void;
  focus(): void;
}

export function createChatPanel(parent: HTMLElement, onSend: (text: string) => void): ChatPanel {
  const panel = el('div', 'frame panel chat-panel');
  const log = el('div', 'chat-log');
  log.setAttribute('role', 'log');
  const empty = el('div', 'chat-empty', 'Nobody has said anything here yet.');
  log.appendChild(empty);
  const form = el('form', 'chat-form');
  const input = el('input', 'chat-input');
  input.type = 'text';
  input.maxLength = CHAT_MAX_LENGTH;
  input.placeholder = 'Say something…';
  input.enterKeyHint = 'send';
  input.autocomplete = 'off';
  const send = textButton('Say', () => {}, 'chat-send');
  send.type = 'submit';
  form.append(input, send);
  panel.append(el('h2', 'panel-title', 'Chat'), log, form);
  parent.appendChild(panel);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = '';
    if (text.trim()) onSend(text);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') input.blur();
    e.stopPropagation();
  });

  return {
    el: panel,
    add(line) {
      empty.remove();
      const row = el('div', 'chat-line');
      row.append(el('b', '', `${line.name}: `), document.createTextNode(line.text));
      const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 4;
      log.appendChild(row);
      while (log.childElementCount > CHAT_LOG_MAX) log.firstElementChild?.remove();
      if (atBottom) log.scrollTop = log.scrollHeight;
    },
    clear() {
      log.replaceChildren(empty);
    },
    focus() {
      input.focus();
    },
  };
}
