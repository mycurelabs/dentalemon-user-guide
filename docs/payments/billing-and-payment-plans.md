# Billing, balances and payment plans

See what came in, who still owes you, what HMOs and PhilHealth owe, and set up payment plans for bigger treatments.
{ .meta }

**Time:** about 5 minutes to learn · **You'll need:** some bills already made at the [Cashier](charges-and-cashier.md).
{ .meta }

## Before you start

- **Billing** is for looking back and following up. Day-to-day payments happen at the [Cashier](charges-and-cashier.md).

## Steps

### 1. Open Billing

Tap **Billing** in the sidebar.

You should see: five tabs (**Transactions**, **Total sales**, **Payments due**, **Accounts receivable**, **Payment plans**) with **Transactions** open. The cards at the top sum up the period: **Collected**, **Transactions**, **Average ticket** and **Voided**.
{ .see }

![The Billing page on Transactions: summary cards, a search box, Status, Period and Method filters, and a table of invoices with Paid and Unpaid labels](../assets/billing-and-payment-plans/01-transactions.webp)

Use the search box (**Patient or invoice**) and the **Status**, **Period** and **Method** filters to narrow the list. **List** and **Table** switch the layout.

### 2. Check your sales

Tap **Total sales**.

You should see: **Gross sales**, **Discounts**, **Net sales** and **Collection rate** for the period, then one row per day (or per week or month, with **Group by**).
{ .see }

![The Total sales tab: Gross sales, Discounts, Net sales, Collection rate, and a table by day](../assets/billing-and-payment-plans/02-total-sales.webp)

### 3. Follow up unpaid balances

Tap **Payments due**.

You should see: each patient who owes you, how much is unpaid, how many invoices are open, and how long the oldest has waited. Overdue days show in orange.
{ .see }

![The Payments due tab: Total unpaid, Patients owing, Overdue, Average balance, then a list of patients with their unpaid amounts](../assets/billing-and-payment-plans/03-payments-due.webp)

Tap **⋮** on a patient for **Record payment**, **Send reminder**, **View profile** and **View billing**.

![The row menu on a patient's balance: Record payment, Send reminder, View profile, View billing](../assets/billing-and-payment-plans/04-row-actions.webp)

### 4. Record a payment

Tap **Record payment**. **Amount** starts at the full balance. Change it for a partial payment, choose the **Method**, then tap **Record**.

You should see: under **Applies to, oldest first**, which invoices the money will pay off, before you record it.
{ .see }

![The Record payment sheet: Amount ₱3,700, Method Cash, and Applies to, oldest first listing two invoices](../assets/billing-and-payment-plans/05-record-payment.webp){ .shot-sm }

### 5. Track what payers owe you

Tap **Accounts receivable**. This is the money HMOs and PhilHealth owe the clinic for covered work.

You should see: the amounts grouped by age (**0–30 days**, **31–60 days**, **61–90 days**, **90+ days**), and a table of claims with the payer, the patient, the service date, when it was submitted, the amount, the age and the status.
{ .see }

![The Accounts receivable tab: amounts by age, then claims with payer, patient, service date, submitted date and amount](../assets/billing-and-payment-plans/06-accounts-receivable.webp)

A **claim** is what a payer owes for one patient's covered work. Filter by **Status** or **Payer**, or search by patient. Tap **⋮** at the end of a claim's row to move it along as you deal with the payer:

| Status | What it means | What you can do next (in **⋮**) |
|---|---|---|
| **Draft** | Not sent to the payer yet | **Mark submitted** once you've sent it |
| **Submitted** | Sent, waiting for the payer | **Mark approved**, **Mark denied**, **Mark paid**, **Send follow-up** |
| **Approved** | The payer agreed to pay | **Mark paid** when the money arrives, or **Mark denied** |
| **Denied** | The payer refused. You type the reason when you mark it denied. | **Reopen claim** to try again |
| **Paid** | The payer paid | Nothing more to do |

**View claim** shows the claim's details, and **View billing** opens the patient's own billing.

![The claim menu on a Draft claim: View claim, View billing, Mark submitted](../assets/billing-and-payment-plans/07-claim-actions.webp)

When you tap **Mark paid** (or another step), a message with **Undo** appears for a few seconds before the change is saved. **Send follow-up** writes a reminder for you to send from your iPad's share sheet.

![The claim menu on a Submitted claim: View claim, View billing, Mark approved, Mark denied, Mark paid, Send follow-up](../assets/billing-and-payment-plans/07b-claim-submitted-actions.webp)

### 6. Set up a payment plan

Tap **Payment plans**, then **Create payment plan**.

Choose the **Patient**, give the plan a **Plan title**, then fill in **Proposed total (₱)**, **Down payment (₱)**, **Number of monthly installments** and **First installment date**. Under the terms, list the **Included services** and any **Exclusions**, then name the **Responsible payer** and pick their **Payer relationship** (Patient, Parent, Guardian or Other authorized payer). Tap **Save draft agreement**.

The form won't save until the patient, terms and payer are filled in, the installments are between 1 and 60, and the down payment is less than the total.

![The Payment plans tab with no plans yet and a Create payment plan button](../assets/billing-and-payment-plans/08-payment-plans.webp)

You should see: the plan saved as a draft. Drafting a plan does not start treatment, issue an invoice or collect money.
{ .see }

![The Create payment plan form: Patient search, Related case, Plan title, Proposed total 30000, Down payment 6000, 6 monthly installments, First installment date, and Save draft agreement](../assets/billing-and-payment-plans/09-create-payment-plan.webp)

### 7. Take the plan from draft to paid

A payment plan moves through these steps. Each step is a button on the plan's page, and none of them starts treatment.

1. **Draft**: the terms you saved. Check them on the plan's page. To change them, tap **Edit draft**.
2. **Offer agreement**: tap it when you show the terms to the patient. The status changes to **Offered**. Dentalemon doesn't send anything to the patient; to give them a copy, use **Financial documents** on the plan's page.
3. **Record acceptance** or **Record decline**: when the patient answers.
    - For acceptance, fill in **Accepted by** (who agreed), **Capacity** (**Patient**, **Authorized parent / guardian** or **Authorized financial guarantor**) and **Evidence method** (**Written agreement recorded** or **Verbal acceptance documented**). Tick the box confirming you checked their authority, then save. Tap **Keep unaccepted** to go back without recording.
4. **Issue package invoice**: one invoice for the whole plan, with the down payment due today and the rest due monthly. Tap **Issue invoice** to confirm, or **Keep agreement only** to wait.
5. **Record payment**: each time the patient pays, record it here. Dentalemon shows which installments the payment covers before you save.
6. **Finalize invoice**: gives the plan's invoice its number from your series.

You can also open **View invoice** and **Financial statement** (what the patient has paid and still owes) from the plan's page.

You should see: on a draft plan, the terms and **Offer agreement**.
{ .see }

![A draft payment plan for Ocampo, Pilar: Braces — demo plan, its terms and an Offer agreement button](../assets/billing-and-payment-plans/11-plan-draft.webp)

After **Offer agreement**, the plan shows **Offered**, with **Record acceptance** and **Record decline**. If the patient wants different terms, tap **Propose revision** to start a new version of the agreement.

![The same plan Offered, with Record acceptance and Record decline](../assets/billing-and-payment-plans/12-plan-offered.webp)

![The Record financial acceptance sheet: the agreement, Accepted by, Capacity, Evidence method, the confirmation tick box, and Keep unaccepted](../assets/billing-and-payment-plans/13-record-acceptance.webp)

### 8. See one patient's billing

Open a patient and tap the **Billing** tab. Or, in Billing, tap **⋮ › View billing** on a row.

You should see: **Balance due**, **Owed by payers** and **Last payment** at the top, the open invoices with **Record payment** on each, and a **View** menu for **Due**, **Statement**, **Invoices**, **Claims** and **Plans**.
{ .see }

![A patient's Billing tab: Balance due ₱640, Owed by payers ₱1,000, Last payment ₱300 Cash, and two open invoices with Record payment buttons](../assets/billing-and-payment-plans/10-patient-billing.webp)

## Tips

!!! tip "Patient share only"
    **Payments due** counts only what patients owe. What HMOs and PhilHealth owe is under **Accounts receivable**, so the two never double-count.

!!! warning "If something goes wrong"
    **Record stays greyed out.** Read the message under **Amount**: it must be above ₱0 and can't be more than the balance.

!!! info "Good to know"
    - Claims are tracked by hand. **Mark submitted** and **Mark paid** only record what you did with the payer. Dentalemon doesn't send claims to PhilHealth or HMOs, and there are no claim numbers yet.
    - **Send reminder** writes the message for you to check, then opens your device's share sheet (Messages, Mail, Viber and so on). Dentalemon doesn't send it itself.

## What's next

- [Appointments](../schedule/appointments.md)
