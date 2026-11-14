import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import admin from "../../../messages/admin/en.json";
import { Pagination } from "./pagination";

const render = (props: { page: number; pageSize: number; total: number }) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={{ Admin: admin }}>
      <Pagination {...props} onPageChange={() => {}} />
    </NextIntlClientProvider>,
  );

describe("Pagination", () => {
  it("shows the range and page count from the Admin messages, with US number formatting", () => {
    const html = render({ page: 51, pageSize: 20, total: 2500 });

    expect(html).toContain("1,001–1,020 of 2,500");
    expect(html).toContain("51 / 125");
    expect(html).toContain('aria-label="Pagination"');
    expect(html).toContain('aria-label="Previous page"');
    expect(html).toContain('aria-label="Next page"');
  });

  it("clamps the range on the last page", () => {
    expect(render({ page: 3, pageSize: 10, total: 25 })).toContain("21–25 of 25");
  });
});
