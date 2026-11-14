import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { donationConfig } from "@/config/donation";

/** In-memory sessionStorage, since the tests run in Node. */
const createStorage = (): Storage => {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
};

const storage = createStorage();
vi.stubGlobal("sessionStorage", storage);

let useDonationStore: typeof import("@/stores/donation").useDonationStore;

beforeAll(async () => {
  ({ useDonationStore } = await import("@/stores/donation"));
});

const store = () => useDonationStore.getState();

beforeEach(() => {
  store().reset();
  storage.clear();
});

describe("donation store", () => {
  it("starts on a one-time gift of the default amount to the default fund", () => {
    expect(store()).toMatchObject({
      frequency: "one_time",
      amountCents: donationConfig.defaultCents.one_time,
      isCustom: false,
      fundId: donationConfig.defaultFundId,
      coverFees: false,
      tribute: null,
      campaign: null,
    });
  });

  it("moves a preset amount to the new frequency's default", () => {
    store().setAmount(donationConfig.presetsCents.one_time[0]);
    store().setFrequency("monthly");

    expect(store().amountCents).toBe(donationConfig.defaultCents.monthly);
  });

  it("keeps a custom amount when the frequency changes", () => {
    store().setAmount(4200, true);
    store().setFrequency("monthly");

    expect(store()).toMatchObject({ frequency: "monthly", amountCents: 4200, isCustom: true });
  });

  it("choosing a preset after a custom amount clears the custom flag", () => {
    store().setAmount(4200, true);
    store().setAmount(5000);

    expect(store().isCustom).toBe(false);
  });

  it("merges donor details field by field", () => {
    store().setDonor({ firstName: "Ana" });
    store().setDonor({ email: "ana@example.com" });

    expect(store().donor).toEqual({ firstName: "Ana", lastName: "", email: "ana@example.com" });
  });

  it("toggles fee cover", () => {
    store().toggleCoverFees();
    expect(store().coverFees).toBe(true);
    store().toggleCoverFees();
    expect(store().coverFees).toBe(false);
  });

  it("reset clears everything, including the tribute and campaign", () => {
    store().setTribute({ type: "honour", honoreeName: "A1C Diaz" });
    store().setCampaign("spring-2027");
    store().setFund("morale");
    store().reset();

    expect(store()).toMatchObject({ tribute: null, campaign: null, fundId: "general" });
  });

  it("saves only the gift data to sessionStorage, not the actions", () => {
    store().setAmount(4200, true);
    store().setCampaign("spring-2027");

    const saved = JSON.parse(storage.getItem("donation") ?? "{}");
    expect(saved.state).toMatchObject({
      amountCents: 4200,
      isCustom: true,
      campaign: "spring-2027",
    });
    expect(Object.keys(saved.state).sort()).toEqual(
      [
        "amountCents",
        "campaign",
        "coverFees",
        "donor",
        "frequency",
        "fundId",
        "isCustom",
        "tribute",
      ].sort(),
    );
  });

  it("restores a saved gift on rehydrate (the hand-off from the quick-give bar)", async () => {
    store().setFrequency("monthly");
    store().setAmount(7500, true);
    store().setFund("community");
    const saved = storage.getItem("donation");

    store().reset();
    storage.setItem("donation", saved!);
    await useDonationStore.persist.rehydrate();

    expect(store()).toMatchObject({
      frequency: "monthly",
      amountCents: 7500,
      isCustom: true,
      fundId: "community",
    });
  });
});
