"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Is my financial data secure?",
    answer:
      "Your data is protected with bank-grade AES-256 encryption and stored on Australian servers. We use Basiq open banking to connect to your bank — we never see or store your bank passwords. Authentication is handled by Clerk with multi-factor support.",
  },
  {
    question: "Which Australian banks do you support?",
    answer:
      "We support all major Australian banks including Commonwealth Bank, NAB, ANZ, and Westpac, plus over 100 other financial institutions via Basiq open banking.",
  },
  {
    question: "Can I use PropertyTracker with my accountant?",
    answer:
      "Yes. Export ATO-compliant CSV and PDF reports at any time. You can also share read-only portfolio access directly with your accountant or broker via the Team plan.",
  },
  {
    question: "Does it work with trusts and SMSFs?",
    answer:
      "Yes. PropertyTracker supports individual ownership, family trusts, unit trusts, companies, and self-managed super funds with full compliance tracking for each entity type.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes, no lock-in contracts. Cancel anytime and keep access until the end of your current billing period. Your data remains available for export.",
  },
  {
    question: "Is there a free plan?",
    answer:
      "Yes. Track 1 property free forever with bank feeds and basic tax categorization. Upgrade to Pro when you add more properties.",
  },
  {
    question: "How does the lifetime deal work?",
    answer:
      "Pay $249 once and get permanent Pro access — no monthly or annual fees ever. This is limited to our first 100 founding members and the offer will be removed once all spots are claimed.",
  },
];

export function FaqSection() {
  return (
    <section className="py-20 px-4 bg-secondary">
      <div className="container mx-auto max-w-3xl">
        <h2 className="text-3xl font-bold text-center mb-4">
          Frequently asked questions
        </h2>
        <p className="text-center text-muted-foreground mb-12">
          Everything you need to know about PropertyTracker.
        </p>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
