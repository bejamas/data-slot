import { describe, expect, it } from "bun:test";
import { createToastInteraction } from "./toast-interaction";

describe("Toast interaction state", () => {
  const setup = () => {
    let exiting = false;
    const expanded: boolean[] = [];
    const paused: boolean[] = [];
    const interaction = createToastInteraction({
      hasExitingEntries: () => exiting,
      setExpanded: (value) => expanded.push(value),
      setPaused: (value) => paused.push(value),
    });
    return { interaction, expanded, paused, setExiting: (value: boolean) => { exiting = value; } };
  };

  it("starts collapsed and running", () => {
    const { interaction } = setup();
    expect(interaction.expanded).toBe(false);
    expect(interaction.paused).toBe(false);
  });

  it("hover and focus pause timers and expand the stack", () => {
    const { interaction, paused } = setup();
    interaction.set("hover", true);
    expect(interaction.expanded).toBe(true);
    expect(interaction.paused).toBe(true);

    interaction.set("focus", true);
    interaction.set("hover", false);
    expect(interaction.expanded).toBe(true);
    expect(interaction.paused).toBe(true);

    interaction.set("focus", false);
    expect(interaction.expanded).toBe(false);
    expect(interaction.paused).toBe(false);
    expect(paused).toEqual([true, false]);
  });

  it("window and document reasons pause timers without expanding", () => {
    const { interaction } = setup();
    interaction.set("window", true);
    expect(interaction.paused).toBe(true);
    expect(interaction.expanded).toBe(false);

    interaction.set("document", true);
    interaction.set("window", false);
    expect(interaction.paused).toBe(true);

    interaction.set("document", false);
    expect(interaction.paused).toBe(false);
  });

  it("reports pause changes once per transition", () => {
    const { interaction, paused } = setup();
    interaction.set("hover", true);
    interaction.set("window", true);
    interaction.set("hover", false);
    interaction.set("window", false);
    expect(paused).toEqual([true, false]);
  });

  it("keeps the stack expanded after interaction ends while entries are exiting", () => {
    const { interaction, setExiting } = setup();
    interaction.set("hover", true);
    setExiting(true);
    interaction.set("hover", false);
    expect(interaction.expanded).toBe(true);
    expect(interaction.paused).toBe(false);

    interaction.sync();
    expect(interaction.expanded).toBe(true);

    setExiting(false);
    interaction.sync();
    expect(interaction.expanded).toBe(false);
  });

  it("does not defer collapse when the interaction reason was never active", () => {
    const { interaction, setExiting } = setup();
    setExiting(true);
    interaction.set("hover", false);
    expect(interaction.expanded).toBe(false);
  });

  it("does not defer collapse for non-interaction reasons", () => {
    const { interaction, setExiting } = setup();
    interaction.set("window", true);
    setExiting(true);
    interaction.set("window", false);
    expect(interaction.expanded).toBe(false);
  });

  it("clears a deferred collapse when interaction resumes", () => {
    const { interaction, setExiting } = setup();
    interaction.set("focus", true);
    setExiting(true);
    interaction.set("focus", false);
    expect(interaction.expanded).toBe(true);

    interaction.set("hover", true);
    interaction.set("hover", false);
    setExiting(false);
    interaction.sync();
    expect(interaction.expanded).toBe(false);
  });
});
