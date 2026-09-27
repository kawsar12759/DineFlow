import { describe, expect, it } from "vitest";
import {
  bookingReceivedEmail,
  feedbackReplyEmail,
} from "@/lib/email/templates";

const booking = {
  guestName: `<img src=x onerror="alert(1)">`,
  restaurantName: "Ember & Oak",
  branchName: "Gulshan",
  branchAddress: "Road 1, Dhaka",
  date: "2026-09-30",
  time: "19:00",
  guests: 2,
  manageUrl: "https://dineflow.test/booking/abc",
};

describe("email templates", () => {
  it("escapes what guests typed in the HTML but not in the text version", () => {
    const email = bookingReceivedEmail(booking, true);

    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(email.html).toContain("Ember &amp; Oak");
    expect(email.text).toContain(`<img src=x onerror="alert(1)">`);
    expect(email.text).toContain("Ember & Oak");
  });

  it("escapes a reply exactly once", () => {
    const email = feedbackReplyEmail({
      guestName: "Tahmina",
      restaurantName: "Ember & Oak",
      reply: "Sorry — <b>next one</b> is on us & more",
    });

    expect(email.html).toContain("&lt;b&gt;next one&lt;/b&gt; is on us &amp; more");
    expect(email.html).not.toContain("&amp;lt;");
    expect(email.text).toContain("<b>next one</b> is on us & more");
  });
});
