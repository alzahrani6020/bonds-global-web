const fs = require('fs');
const path = require('path');

describe('BONDS assistant movable and resizable window layout', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'v3', 'components', 'ai-chat-widget.js'),
    'utf8'
  );

  test('uses one versioned persistent layout state', () => {
    expect(source).toContain("const ASSISTANT_LAYOUT_KEY = 'bonds.assistant.layout.v1';");
    expect(source).toContain('const ASSISTANT_LAYOUT_VERSION = 1;');
    expect(source).toContain('window.localStorage?.getItem(ASSISTANT_LAYOUT_KEY)');
    expect(source).toContain('window.localStorage?.setItem(ASSISTANT_LAYOUT_KEY');
    expect(source).toContain('window.localStorage?.removeItem(ASSISTANT_LAYOUT_KEY)');
  });

  test('supports pointer-driven move and resize only in standard desktop mode', () => {
    expect(source).toContain("chatHeader.addEventListener('pointerdown'");
    expect(source).toContain("window.addEventListener('pointermove', updateLayoutInteraction)");
    expect(source).toContain("window.addEventListener('pointerup', finishLayoutInteraction)");
    expect(source).toContain("beginLayoutInteraction('move'");
    expect(source).toContain("beginLayoutInteraction('resize'");
    expect(source).toContain("state.viewMode !== 'standard'");
    expect(source).toContain("window.innerWidth) || 0) <= 640");
  });

  test('provides visible resize handles without adding a parallel assistant', () => {
    expect(source).toContain('data-resize-edge="left"');
    expect(source).toContain('data-resize-edge="right"');
    expect(source).toContain('data-resize-edge="bottom"');
    expect(source).toContain('data-resize-edge="right-bottom"');
    expect(source).toContain('.bonds-ai-chat-window.open.view-standard .bonds-ai-resize-handle');
    expect(source).toContain('cursor: ew-resize;');
    expect(source).toContain('cursor: ns-resize;');
    expect(source).toContain('cursor: nwse-resize;');
  });

  test('clamps layout to the viewport and snaps to side docks', () => {
    expect(source).toContain('function normalizeAssistantLayout(value)');
    expect(source).toContain('ASSISTANT_LAYOUT_MIN_WIDTH');
    expect(source).toContain('ASSISTANT_LAYOUT_MIN_HEIGHT');
    expect(source).toContain('function snapAssistantLayout(layout)');
    expect(source).toContain("next.dock = 'left'");
    expect(source).toContain("next.dock = 'right'");
    expect(source).toContain('ASSISTANT_LAYOUT_SNAP');
  });

  test('integrates layout with existing view modes and reset control', () => {
    expect(source).toContain('class="bonds-ai-layout-reset"');
    expect(source).toContain('function resetAssistantLayout()');
    expect(source).toContain("if (safeMode === 'standard')");
    expect(source).toContain('applyStandardLayout(standardLayout)');
    expect(source).toContain('clearStandardLayoutStyles()');
    expect(source).toContain('window.BondsAssistant.resetLayout = resetAssistantLayout;');
    expect(source).toContain('window.BondsAssistant.getLayout = () => ({ ...standardLayout });');
  });

  test('keeps existing mobile fullscreen behavior authoritative', () => {
    expect(source).toContain('@media (max-width: 640px)');
    expect(source).toContain('width: 100vw;');
    expect(source).toContain('height: 100dvh;');
  });
});
