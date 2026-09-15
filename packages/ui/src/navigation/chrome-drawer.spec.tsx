import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChromeDrawer } from './chrome-drawer';
import { OrganizationSwitcher } from './organization-switcher';
import type { NavLinkComponent } from './nav-link';

/**
 * §4.2's compact chrome (task 108).
 *
 * **What is asserted here is the modal contract, because that is what a drawer gets wrong.** The
 * five destinations are the same data `workspace-nav.spec.tsx` covers; the focus trap, the return
 * of focus, Escape and the outside content going `aria-hidden` are this component's own, and they
 * are the difference between a panel and a `<div>` that happens to be on top.
 *
 * **`aria-modal` is deliberately not asserted.** Radix 1.x does not set it — it hides the rest of
 * the document instead, which is the mechanism with working AT support — so a test demanding the
 * attribute would fail against a correct implementation and pass against a hand-rolled one that
 * traps nothing.
 */
const SECTIONS = [
  { key: 'home', href: '/home', label: 'Home' },
  { key: 'reports', href: '/reports', label: 'Reports' },
  { key: 'entities', href: '/entities', label: 'Entities' },
] as const;

const drawer = (active = '/entities') =>
  render(
    <>
      <main>page content</main>
      <ChromeDrawer
        label="Menu"
        closeLabel="Close the menu"
        sectionsLabel="Organisation sections"
        brand={<span>easyESG</span>}
        items={SECTIONS}
        isActive={(item) => item.href === active}
        actions={<button type="button">Sign out</button>}
      />
    </>,
  );

describe('ChromeDrawer', () => {
  it('is closed until the trigger is used, and the panel is not in the document before then', () => {
    drawer();

    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on the trigger and names itself, its sections and its close control', async () => {
    drawer();
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));

    const panel = screen.getByRole('dialog', { name: 'Menu' });
    expect(panel).toBeInTheDocument();
    // The band's own name, reused: the drawer IS the workspace tier at this frame, so a second
    // name would describe two navigations to a screen reader that has one.
    expect(screen.getByRole('navigation', { name: 'Organisation sections' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close the menu' })).toBeInTheDocument();
  });

  it('carries the sections in order, with the current one marked on its anchor', async () => {
    drawer();
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));

    const panel = screen.getByRole('dialog');
    expect([...panel.querySelectorAll('nav a')].map((a) => a.textContent)).toEqual([
      'Home',
      'Reports',
      'Entities',
    ]);
    // Task 105's rule, applied here too: on the anchor, where a reader moving link-to-link hears it.
    const current = screen.getAllByRole('link', { current: 'page' });
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Entities');
  });

  it('hides the rest of the document while open, and stops when closed', async () => {
    drawer();
    const trigger = screen.getByRole('button', { name: 'Menu' });
    await userEvent.click(trigger);

    // **Asserted as the effect, not as the attribute**, and the first draft of this line got it
    // wrong in a way worth keeping: it looked for `aria-hidden` on `<main>` and found it in a
    // browser but not in jsdom. Radix hides the *siblings of the portal*, and Testing Library
    // renders into a container div, so in jsdom the attribute lands on that container with `main`
    // inside it. Where the attribute sits is environment-dependent; that the landmark leaves the
    // accessibility tree is not — and `queryByRole` excludes `aria-hidden` subtrees, so this is
    // the same guarantee stated in a way both environments agree on.
    expect(screen.queryByRole('main')).not.toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    // Focus returns to what opened it — the half a hand-rolled panel forgets, and the one a
    // keyboard user notices immediately.
    expect(trigger).toHaveFocus();
  });

  it('closes when a destination is chosen', async () => {
    drawer();
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));

    await userEvent.click(screen.getByRole('link', { name: 'Reports' }));

    // **Radix has no reason to close on its own here.** A `Link` inside the panel is a client-side
    // navigation: the route changes and nothing unmounts, so without this the panel stays open on
    // top of the screen the reader just asked for — every tap costing a second one to dismiss it.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on an action too, including one that is not a link', async () => {
    drawer();
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));

    // Sign-out is a submit button, not an anchor — it leaves the screen by a form action rather
    // than an href, so a rule written only for links would leave the panel open behind it.
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders its sections through an injected link component', async () => {
    const Localized: NavLinkComponent = ({ href, children, ...rest }) => (
      <a href={`/ru${href}`} {...rest}>
        {children}
      </a>
    );
    render(
      <ChromeDrawer
        label="Menu"
        closeLabel="Close"
        sectionsLabel="Sections"
        brand={<span>easyESG</span>}
        items={SECTIONS}
        isActive={() => false}
        linkComponent={Localized}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/ru/home');
  });

  /**
   * Task 83.2: the organization's switcher lives in the panel at this frame, and it opens a menu that
   * Radix portals out of the panel. **The real switcher, not a stand-in**, because what the close rule
   * reads — the trigger's `aria-haspopup`, the row's role, and React bubbling a portalled event through
   * the tree that rendered it — is Radix's behaviour, and a fake would assert the rule against itself.
   */
  const withSwitcher = (onChoose: (key: string) => void = () => undefined) =>
    render(
      <ChromeDrawer
        label="Menu"
        closeLabel="Close"
        sectionsLabel="Sections"
        brand={<span>easyESG</span>}
        items={SECTIONS}
        organization={
          <OrganizationSwitcher
            label="Active organization"
            organizations={[
              { key: 'org-a', name: 'Brutăria Lina SRL', detail: 'Organization administrator' },
              { key: 'org-b', name: 'Grupul Lina', detail: 'Editor' },
            ]}
            currentKey="org-a"
            onChoose={onChoose}
            closingItem={<a href="/create-organization">Create another organization</a>}
          />
        }
      />,
    );

  it('carries the organization’s switcher, and opening it leaves the panel standing', async () => {
    withSwitcher();
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));

    await userEvent.click(screen.getByRole('button', { name: /Active organization/ }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2);
  });

  it('closes once an organization is chosen in that menu, though the menu is portalled out of it', async () => {
    const chosen: string[] = [];
    withSwitcher((key) => chosen.push(key));
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    await userEvent.click(screen.getByRole('button', { name: /Active organization/ }));

    await userEvent.click(screen.getAllByRole('menuitemradio')[1]);

    expect(chosen).toEqual(['org-b']);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('omits the secondary block when the caller gives none', async () => {
    render(
      <ChromeDrawer
        label="Menu"
        closeLabel="Close"
        sectionsLabel="Sections"
        brand={<span>easyESG</span>}
        items={SECTIONS}
        isActive={() => false}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));

    // The rule the specimen draws belongs to the entries below it; with none, drawing it would be
    // a division with nothing on one side.
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });
});
