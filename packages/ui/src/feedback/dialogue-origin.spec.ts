import { afterEach, describe, expect, it } from 'vitest';
import { dialogueOrigin } from './dialogue-origin';

/** Where a dialogue hands focus back to (task 207; UX-113), over the markup a Radix menu renders. */
describe('dialogueOrigin', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  const element = (tag: string, attributes: Readonly<Record<string, string>> = {}) => {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    return node;
  };

  it('is the control that held focus as the dialogue opened', () => {
    const button = element('button');
    document.body.append(button);
    expect(dialogueOrigin(button)).toBe(button);
  });

  it('is the menu’s button where an item in the menu raised it — the item closes with its menu', () => {
    const trigger = element('button', { id: 'more-1' });
    const menu = element('div', { role: 'menu', 'aria-labelledby': 'more-1' });
    const item = element('div', { role: 'menuitem' });
    menu.append(item);
    document.body.append(trigger, menu);
    expect(dialogueOrigin(item)).toBe(trigger);
  });

  it('is the item itself where its menu names no button', () => {
    const menu = element('div', { role: 'menu' });
    const item = element('div', { role: 'menuitem' });
    menu.append(item);
    document.body.append(menu);
    expect(dialogueOrigin(item)).toBe(item);
  });

  it('is nothing where nothing held focus', () => {
    expect(dialogueOrigin(document.body)).toBeNull();
    expect(dialogueOrigin(null)).toBeNull();
  });
});
