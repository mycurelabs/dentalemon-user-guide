# Charges and payment at the Cashier

Put the visit's work on the bill, send it to the Cashier, apply a Senior Citizen, PWD or insurance discount, and take payment.
{ .meta }

**Time:** about 3 minutes per patient · **You'll need:** an open encounter with some work done, and your price list set up in **Settings › Services**.
{ .meta }

## Before you start

- Record the work you did in the chart, and mark it **Done today**. See [Chart teeth](../visits/chart-teeth.md).
- Prices come from your price list. See [Settings basics](../clinic/settings-basics.md).
- Payment is never taken inside the encounter. The encounter decides **what** is charged; the **Cashier** takes the money.

## Steps

### 1. Open the charges from the encounter

In the encounter, look at the top-right button. While the visit is still going, it reads **Finish encounter**. After the visit has ended, it reads **Charges**.

Tap it.

![The encounter workspace for Mario Ledesma with the Finish encounter button at the top right](../assets/charges-and-cashier/01-encounter-top-bar.webp)

You should see: the **Finish encounter** sheet. Under **Charges** are the visit itself (for example **Consultation**, from the encounter type) and each piece of work marked **Done today**, with its price. Nothing is ticked yet, and **Total charges** is ₱0.
{ .see }

![The Finish encounter sheet with Consultation ₱500 and Extraction · 36 ₱2,500 listed, both unticked, Total charges ₱0](../assets/charges-and-cashier/02-charges-unticked.webp)

### 2. Tick what you're charging

Tap the box next to each line you want on the bill.

You should see: a tick on each line, a short note such as **Extraction · 36 added to the invoice** (with **Undo**), and the new **Total charges**. The yellow button now reads **End and send to cashier · ₱3,000**.
{ .see }

![Both charge lines ticked, Total charges ₱3,000, and buttons End encounter and End and send to cashier · ₱3,000](../assets/charges-and-cashier/03-charges-ticked.webp)

### 3. Add anything else from your price list (optional)

Tap **Add charge**, type part of the name (for example *certificate*), then tap the item.

You should see: the item added to the list, already ticked.
{ .see }

![The Charges search with certificate typed and Dental certificate ₱300 as the result](../assets/charges-and-cashier/04-add-charge.webp){ .shot-sm }

### 4. Send it to the Cashier

Tap **End and send to cashier · ₱X**. This ends the visit and puts the bill in the Cashier's **Waiting** list.

You should see: the sheet closes. The top-right button now reads **Charges**.
{ .see }

!!! tip
    To end the visit without billing yet, tap **End encounter** instead. You can open **Charges** again later and send it then.
    See [Finish the visit](../visits/finish-the-visit.md).

### 5. Find the bill at the Cashier

Tap **Cashier** in the sidebar.

You should see: the **Waiting** list. Each row shows the patient, the visit type, how many charges and when the bill was ready, and the amount. The number next to **Cashier** in the sidebar counts the bills waiting.
{ .see }

![The Cashier page with five bills Waiting, including Ledesma, Mario, 2 charges, ₱3,000](../assets/charges-and-cashier/05-cashier-waiting.webp)

Tap the **List** menu (it shows **Waiting**) to switch to the other lists: **In consultation**, **In progress** and **Paid today**.

### 6. Open the invoice

Tap the patient's row.

You should see: the invoice. **Items on this invoice** is in the middle, the totals are on the right, and **Collect · ₱X** is at the bottom. On the left, **Add to invoice** lets the cashier add more items from the price list.
{ .see }

![The invoice for Ledesma, Mario: Consultation ₱500 and Extraction · 36 ₱2,500, Discount Apply, Coverage Apply, Balance due ₱3,000, Collect · ₱3,000](../assets/charges-and-cashier/06-invoice.webp)

### 7. Apply a Senior Citizen or PWD discount

Next to **Discount**, tap **Apply**. Choose **Senior Citizen** or **PWD**, and check the ID number. If the ID is already in the patient's details, it fills in by itself. Then tap **Apply discount**.

You should see: the discount and the new total before you confirm it (20% off).
{ .see }

![The Discount sheet with Senior Citizen chosen, Senior Citizen ID no. SC-TEST-0001, 20% off −₱600, Total ₱2,400](../assets/charges-and-cashier/07-apply-discount.webp){ .shot-sm }

Back on the invoice, each line shows its discount under **Adjustments**, and **Balance due** goes down.

![The invoice after the discount: Senior Citizen discount −₱600, Total ₱2,400, Collect · ₱2,400](../assets/charges-and-cashier/08-invoice-discounted.webp)

### 8. Apply insurance coverage (if the patient has it)

Next to **Coverage**, tap **Apply**. Choose **HMO** or **PhilHealth**. If you have an approval or LOA number, type it in. Then tap **Apply coverage**.

You should see: what the payer covers line by line (**Not covered** where it pays nothing), then **PhilHealth pays** (or the HMO's name) and **Patient pays**.
{ .see }

![The Coverage sheet with PhilHealth chosen: Consultation ₱500 covered, Extraction · 36 Not covered, PhilHealth pays ₱500, Patient pays ₱2,500](../assets/charges-and-cashier/13-apply-coverage.webp){ .shot-sm }

### 9. Collect the payment

Tap **Collect · ₱X**. Under **Pay with**, choose **Cash**, **GCash**, **Card** or **Bank transfer**.

For cash, type the amount the patient handed you in **Cash received**, or tap a quick amount such as **Exact ₱2,400** or **₱2,500**. Dentalemon works out the **Change**. The **Official receipt** number is the next in your series.

Tap **Collect ₱X**.

![The Collect payment sheet: Cash chosen, Amount ₱2,400, Cash received ₱2,500, Change ₱100, Official receipt Next in series](../assets/charges-and-cashier/09-collect-cash.webp)

You should see: the receipt with its number, the change, and **Balance due · Paid in full**. Tap **Done**.
{ .see }

![The receipt: Cash ₱2,400, Official receipt number, Change ₱100, Balance due Paid in full](../assets/charges-and-cashier/10-paid.webp)

### 10. Print the invoice (optional)

Tap **Print** at the top of the invoice, check the preview, then tap **Print**.

![The Print invoice preview: clinic name and address, the patient, the items, the Senior Citizen discount with its ID, total ₱2,400, paid in cash](../assets/charges-and-cashier/11-print.webp)

## Other things you can do

- **More (⋯)** on the invoice has **Send receipt**, **Duplicate as new sale** and **Void…**.

    ![The More menu on a paid invoice: Send receipt, Duplicate as new sale, Void…](../assets/charges-and-cashier/12-more-menu.webp)

- **Void…** cancels the whole invoice, or only some items, and asks for a reason.
- **New sale** (top of the Cashier page) bills a patient who didn't have a visit, for example someone buying an item. Search for the patient, or tap **Add a new patient**, then **Start sale**.

    ![The New sale sheet with a patient search, Add a new patient, and Start sale](../assets/charges-and-cashier/14-new-sale.webp){ .shot-sm }

## Tips

!!! tip "Partial payments"
    To take part of the bill now, change **Amount** in **Collect payment** before you tap **Collect**. The rest stays in **Balance due**, and you can follow it up in [Billing](billing-and-payment-plans.md).

!!! warning "If something goes wrong"
    **The Discount or Coverage Apply button is gone.** These lock once the first payment is taken. Apply the discount or coverage before collecting.

    **A charge is missing at the Cashier.** Open the encounter's **Charges** and check the line is ticked.

!!! info "Good to know"
    - A line can't have both a payer's coverage and a Senior Citizen or PWD discount. The discount applies only to lines the payer doesn't cover.
    - **Send receipt** opens your device's Mail or Messages app. Dentalemon doesn't send it for you.
    - A patient gets a Senior Citizen discount only with a Senior Citizen ID number, and a PWD discount only with a PWD ID number.

## What's next

- [Billing, balances and payment plans](billing-and-payment-plans.md)
