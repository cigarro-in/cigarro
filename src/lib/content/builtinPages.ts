// Default content for the built-in store pages (About, Contact, policies).
// These are the words the storefront shows until the store saves its own
// version in Content > Pages. Pure data: no React, no Convex.
//
// Store-specific values are tokens, filled at render time from store settings
// (see storePageTokens.ts): {{storeName}}, {{supportEmail}}, {{supportPhone}},
// {{address}} and {{deliveryOptions}} (live shipping methods, Shipping page).
// The admin editor shows the tokens as written.

export const BUILTIN_STORE_PAGE_SLUGS = [
  'about',
  'contact',
  'legal',
  'terms',
  'privacy',
  'shipping',
  'returns',
] as const;

export type BuiltInStorePageSlug = (typeof BUILTIN_STORE_PAGE_SLUGS)[number];

export interface BuiltInStorePage {
  slug: BuiltInStorePageSlug;
  /** Page heading and breadcrumb label. */
  title: string;
  /** Meta title before tokens are filled. */
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  /** Body HTML, limited to the sanitizer allowlist (src/lib/blog/blogRender.ts). */
  html: string;
}

export const BUILTIN_STORE_PAGES: readonly BuiltInStorePage[] = [
  {
    slug: 'about',
    title: 'About us',
    seoTitle: 'About {{storeName}} | Online Cigarette Store in India',
    seoDescription:
      'Learn how {{storeName}} helps adult customers in India browse cigarette brands, compare pack options and find clear product information online.',
    keywords: ['about {{storeName}}', 'online cigarette store India', 'cigarette brands India'],
    html: `
<h2>Buying cigarettes online should not feel confusing.</h2>
<p>{{storeName}} is an online cigarette store for adult customers in India. We bring brands, variants, pack details and pricing together so you can find what you are looking for without working through vague listings.</p>
<h2>Why {{storeName}} exists</h2>
<p>Cigarette listings can be difficult to navigate. Product names vary, pack information is often incomplete, and availability is not always obvious.</p>
<p>We built {{storeName}} to make that experience more straightforward. Products are organised by brand and category, while each listing is designed to show the variant, format, quantity and current price before you place an order.</p>
<p>{{storeName}} is still improving. Our focus is practical: clearer product information, a better-organised catalogue and support that is easy to reach when something is unclear.</p>
<h2>Ways to browse</h2>
<ul>
<li><a href="/brands">Find the brand you know</a>: search the catalogue directly or browse all available brands in one place.</li>
<li><a href="/products">Compare the details that matter</a>: see the variant, pack format, quantity, price and availability before you order.</li>
<li><a href="/contact">Ask when something is unclear</a>: get help with a product, an existing order or using the website.</li>
</ul>
<h2>Adults only</h2>
<p>{{storeName}} is intended only for adults of legal smoking age. Tobacco and nicotine products carry serious health risks and can be addictive. We do not encourage anyone who does not already use tobacco to begin.</p>
<p>Read our <a href="/terms">Terms of service</a> and <a href="/privacy">Privacy policy</a>, or <a href="/contact">contact {{storeName}}</a>.</p>
`,
  },
  {
    slug: 'contact',
    title: 'Contact',
    seoTitle: 'Contact {{storeName}} | Order and Product Support',
    seoDescription:
      'Contact {{storeName}} for help with an order, a product listing, shipping or using the online store. Email {{supportEmail}}.',
    keywords: ['contact {{storeName}}', '{{storeName}} support', '{{storeName}} order help'],
    html: `
<h2>Tell us what you need help with.</h2>
<p>Questions about an order, a product listing or the website are all welcome. Send the useful details in your first message and we can give you a clearer answer.</p>
<h2>Email support</h2>
<p>Email is the current support channel for {{storeName}}. Send your question with the relevant product link or order number and we will reply with the information available to us.</p>
<p><a href="mailto:{{supportEmail}}">Email {{supportEmail}}</a></p>
<p>Phone: {{supportPhone}}</p>
<p>Address: {{address}}</p>
<h2>Put the right details in your message</h2>
<ul>
<li><strong>An existing order:</strong> include your order number and the phone number used at checkout so we can identify it.</li>
<li><strong>A product question:</strong> send the product name or page link and tell us exactly what you need to know.</li>
<li><strong>A damaged or incorrect item:</strong> include your order number and clear photos. Review the returns policy before writing.</li>
</ul>
<h2>Before you write</h2>
<p>The answer may already be here.</p>
<ul>
<li><a href="/shipping">Read shipping policy</a></li>
<li><a href="/returns">Read returns policy</a></li>
</ul>
`,
  },
  {
    slug: 'legal',
    title: 'Policies',
    seoTitle: '{{storeName}} Policies | Terms, Privacy, Shipping and Returns',
    seoDescription:
      "Find {{storeName}}'s terms of service, privacy policy, shipping information and returns and refunds policy.",
    keywords: [
      '{{storeName}} policies',
      '{{storeName}} terms',
      '{{storeName}} privacy',
      '{{storeName}} shipping',
      '{{storeName}} returns',
    ],
    html: `
<p>Start with the policy that matches your question. Each page explains the current position and how to contact {{storeName}} when you need help.</p>
<p><strong>Adults of legal smoking age only.</strong> Tobacco and nicotine products carry serious health risks and can be addictive. Age verification may be required before an order is accepted or delivered.</p>
<h2><a href="/terms">Terms of Service</a></h2>
<p>The rules that apply when you browse the website, create an account or place an order.</p>
<h2><a href="/privacy">Privacy Policy</a></h2>
<p>What personal information we collect, why we use it and how to make a data request.</p>
<h2><a href="/shipping">Shipping Policy</a></h2>
<p>Delivery availability, shipping options, tracking and age verification information.</p>
<h2><a href="/returns">Returns and Refunds</a></h2>
<p>What to do when an order arrives damaged, defective or different from what you ordered.</p>
`,
  },
  {
    slug: 'terms',
    title: 'Terms of Service',
    seoTitle: 'Terms of Service | {{storeName}}',
    seoDescription:
      'Read the terms that apply when you browse, create an account or place an order with {{storeName}}.',
    keywords: ['terms of service', 'legal terms', 'user agreement', '{{storeName}} terms'],
    html: `
<p><strong>Age verification required.</strong> You must be 18 years or older to purchase tobacco products from {{storeName}}. By using our services, you confirm that you are of legal smoking age in your jurisdiction.</p>
<h2>1. Acceptance of Terms</h2>
<p>By accessing or using {{storeName}}, you agree to these terms. If you do not agree, please do not use the website or place an order.</p>
<h2>2. Product Information</h2>
<p>All product descriptions, images, and specifications are provided for informational purposes. We strive for accuracy but cannot guarantee that all information is complete, reliable, or error-free.</p>
<h2>3. Health Disclaimer</h2>
<p><strong>Important:</strong> Tobacco products are harmful to your health and may cause serious health conditions including cancer, heart disease, and respiratory problems. Smoking is addictive and can be fatal. We strongly advise against tobacco use and encourage smoking cessation.</p>
<h2>4. Age Restrictions</h2>
<p>You must be at least 18 years old to purchase tobacco products. We reserve the right to request age verification and refuse service to anyone who cannot provide adequate proof of age.</p>
<h2>5. Payment and Billing</h2>
<p>Prices and availability can change. Payment instructions and the final payable amount are shown during checkout. We may refuse or cancel an order when we cannot lawfully or operationally fulfil it.</p>
<h2>6. Limitation of Liability</h2>
<p>To the extent permitted by applicable law, {{storeName}} is not liable for indirect, incidental or consequential loss resulting from use of the website or products. Nothing in these terms excludes a right that cannot lawfully be excluded.</p>
<h2>7. Modifications to Terms</h2>
<p>We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting. Your continued use of our services constitutes acceptance of the modified terms.</p>
<h2>Questions?</h2>
<p>Email <a href="mailto:{{supportEmail}}">{{supportEmail}}</a>.</p>
<p>Last updated: 20 September 2026</p>
`,
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    seoTitle: 'Privacy Policy | {{storeName}}',
    seoDescription:
      'Learn what personal information {{storeName}} collects, why it is used, when it may be shared and how to make a privacy request.',
    keywords: ['privacy policy', 'data protection', 'user privacy', '{{storeName}} privacy'],
    html: `
<p>This policy explains what information {{storeName}} collects, why we use it, when it may be shared and how you can contact us about it.</p>
<h2>1. Information We Collect</h2>
<p>We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us for support. This may include:</p>
<ul>
<li>Name and contact information (email, phone, address)</li>
<li>Order amounts, payment status and transaction references</li>
<li>Account identifiers and preferences</li>
<li>Communication history and support requests</li>
<li>Purchase history and product preferences</li>
</ul>
<h2>2. How We Use Your Information</h2>
<p>We use the information we collect to:</p>
<ul>
<li>Process transactions and fulfill orders</li>
<li>Provide customer support and respond to inquiries</li>
<li>Improve our services and user experience</li>
<li>Send important updates about your account or orders</li>
<li>Comply with legal requirements and regulations</li>
<li>Prevent fraud and ensure platform security</li>
</ul>
<h2>3. Data Security</h2>
<p>We use technical and organisational safeguards intended to protect personal information. No online service can guarantee absolute security, so please contact us if you believe your account or information has been misused.</p>
<h2>4. Cookies and Tracking</h2>
<p>We use cookies and similar technologies to enhance your browsing experience, analyze site traffic, and personalize content. You can control cookie settings through your browser preferences.</p>
<ul>
<li>Essential cookies: required for basic website functionality</li>
<li>Analytics cookies: help us understand how visitors use our site</li>
<li>Preference cookies: remember your settings and preferences</li>
</ul>
<h2>5. Information Sharing</h2>
<p>We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:</p>
<ul>
<li>With service providers who assist in our operations (shipping, payment processing)</li>
<li>When required by law or to protect our rights and safety</li>
<li>In connection with a business transfer or acquisition</li>
<li>With your explicit consent</li>
</ul>
<h2>6. Your Rights</h2>
<p>Subject to applicable law, you may ask us to:</p>
<ul>
<li>Access and review your personal information</li>
<li>Request correction of inaccurate data</li>
<li>Request deletion of your personal information</li>
<li>Opt out of marketing communications</li>
<li>Provide a copy of information associated with your account</li>
<li>Stop optional communications</li>
</ul>
<h2>7. Marketing Communications</h2>
<p>We may send you marketing communications about our products and services. You can opt out of these communications at any time by clicking the unsubscribe link in our emails or by contacting us directly. We will still send you important transactional and account-related communications.</p>
<h2>Privacy Questions?</h2>
<p>For privacy and data requests, email <a href="mailto:{{supportEmail}}">{{supportEmail}}</a>.</p>
<p>Last updated: 20 September 2026</p>
`,
  },
  {
    slug: 'shipping',
    title: 'Shipping Policy',
    seoTitle: 'Shipping and Delivery Policy | {{storeName}}',
    seoDescription:
      'See how {{storeName}} delivery availability, shipping options, dispatch, tracking and age verification work for orders within India.',
    keywords: ['shipping policy', 'delivery information', 'shipping costs', 'delivery times India'],
    html: `
<p>Delivery options, estimated times and any shipping charge are shown at checkout before you place the order.</p>
<h2>1. Delivery Areas</h2>
<p>We currently ship only within India. Serviceability depends on the delivery pin code and the available delivery partner.</p>
<ul>
<li>Enter the complete address and pin code during checkout</li>
<li>Delivery options may differ by location</li>
<li>Some remote or restricted pin codes may not be serviceable</li>
<li>An order may be cancelled and refunded if delivery cannot be arranged</li>
</ul>
<p><em>Note: If you are unsure about delivery to your location, please contact our customer support team before placing your order.</em></p>
<h2>2. Delivery Times</h2>
<p>Choose a delivery speed at checkout. The options and prices currently available are:</p>
{{deliveryOptions}}
<ul>
<li>The estimate begins after the order is confirmed for fulfilment</li>
<li>Tracking information is shared when the delivery partner provides it</li>
</ul>
<p><em>Note: Delivery dates are estimates, not guarantees. Carrier delays and service interruptions can affect them.</em></p>
<h2>3. Packaging and Handling</h2>
<p>Orders are packed for transport using the product and order information available to us:</p>
<ul>
<li>Protective outer packaging is used where appropriate</li>
<li>The shipping label contains the information required for delivery</li>
<li>Check the parcel and items promptly after delivery</li>
<li>Report damage or an incorrect item within 48 hours</li>
</ul>
<h2>4. Age Verification and Delivery</h2>
<p>Due to legal requirements, all tobacco product deliveries require age verification:</p>
<ul>
<li>Recipient must be 18 years or older</li>
<li>Valid government-issued ID required at delivery</li>
<li>Delivery cannot be left unattended</li>
<li>Someone of legal age must be present to receive the package</li>
<li>Failed age verification will result in package return</li>
</ul>
<h2>5. Delivery Issues and Returns</h2>
<p>If you experience any issues with your delivery:</p>
<ul>
<li>Contact our customer support immediately</li>
<li>We will review the order details and evidence</li>
<li>An eligible damaged or incorrect item may be replaced or refunded</li>
<li>Failed deliveries due to age verification are non-refundable</li>
<li>Damage or an incorrect item must be reported within 48 hours of delivery</li>
</ul>
<h2>6. International Shipping</h2>
<p>{{storeName}} does not currently offer international shipping.</p>
<ul>
<li>Orders require an Indian delivery address</li>
<li>International forwarding is not supported</li>
<li>We cannot advise on customs or import requirements outside India</li>
</ul>
<p><em>Note: The website will be updated if this policy changes.</em></p>
<h2>7. Tracking Your Order</h2>
<p>Once your order is dispatched, you will receive:</p>
<ul>
<li>A dispatch update when the order leaves for delivery</li>
<li>A tracking number or link when supplied by the delivery partner</li>
<li>Carrier updates and an estimated arrival date where available</li>
<li>Order status in your {{storeName}} account</li>
</ul>
<h2>Shipping Questions?</h2>
<p>For shipping support, email <a href="mailto:{{supportEmail}}">{{supportEmail}}</a>.</p>
<p>Last updated: 20 September 2026</p>
`,
  },
  {
    slug: 'returns',
    title: 'Returns and Refunds',
    seoTitle: 'Returns and Refunds Policy | {{storeName}}',
    seoDescription:
      "Read {{storeName}}'s policy for non-returnable tobacco products and how to report a damaged, defective or incorrect item within 48 hours.",
    keywords: ['returns policy', 'refund policy', 'tobacco returns', 'damaged items replacement'],
    html: `
<p><strong>Important: Tobacco products are non-returnable.</strong> Because tobacco products are consumable goods, we do not accept change-of-mind returns or exchanges after dispatch. Please review the product, variant and quantity before ordering.</p>
<h2>1. When to Report a Problem</h2>
<p>Contact us if an order arrives with one of these issues:</p>
<ul>
<li>Damaged in transit: products that arrive physically damaged (crushed, broken, leaking)</li>
<li>Incorrect items: you received a different product than what you ordered</li>
<li>Manufacturing defects: sealed products with visible manufacturing flaws</li>
</ul>
<p><em>Note: All claims must be reported within 48 hours of delivery with clear photos of the issue.</em></p>
<h2>2. How We Resolve Eligible Claims</h2>
<p>We review the order details and evidence before confirming a resolution. Depending on the issue and availability, we may:</p>
<ul>
<li>Replace the damaged, defective or incorrect item</li>
<li>Refund the affected item when a suitable replacement is unavailable</li>
<li>Ask for further information needed to assess the claim</li>
</ul>
<p><em>Note: Do not dispose of an affected item until support confirms that it is no longer required for review.</em></p>
<h2>3. What We Cannot Accept</h2>
<p>The following are not eligible for any replacement or refund:</p>
<ul>
<li>Change of mind or taste preference</li>
<li>Opened or partially used products</li>
<li>Products stored improperly after delivery</li>
<li>A delivery refused because age verification could not be completed</li>
<li>Delivery address errors provided by customer</li>
<li>Natural variations in tobacco products (leaf color, draw, burn)</li>
</ul>
<h2>4. How to Report an Issue</h2>
<p>If your order qualifies under section 1, here is the process:</p>
<ul>
<li>Take clear photos of the issue within 48 hours of delivery</li>
<li>Email <a href="mailto:{{supportEmail}}">{{supportEmail}}</a> with your order number and photos</li>
<li>Keep the item and its packaging while the claim is reviewed</li>
<li>Wait for support to confirm the available resolution</li>
<li>If a replacement ships, tracking information will be shared when available</li>
</ul>
<h2>5. Refunds</h2>
<p>A refund may be approved when:</p>
<ul>
<li>An eligible item cannot be replaced</li>
<li>An order is cancelled before fulfilment and payment has already been received</li>
<li>A refund is required by applicable law</li>
</ul>
<p><em>Note: The available refund method and expected processing time will be confirmed when the refund is approved.</em></p>
<h2>6. Rolling Papers and Accessories</h2>
<p>For a damaged, defective or incorrect non-tobacco accessory:</p>
<ul>
<li>Report the issue within 48 hours of delivery</li>
<li>Keep the item unused and in its original packaging</li>
<li>Email <a href="mailto:{{supportEmail}}">{{supportEmail}}</a> with the order number and clear photos</li>
<li>Support will confirm whether a replacement, return or refund applies</li>
</ul>
<h2>Questions About Returns?</h2>
<p>For returns support, email <a href="mailto:{{supportEmail}}">{{supportEmail}}</a>.</p>
<p>Last updated: 20 September 2026</p>
`,
  },
];

export function builtInStorePage(slug: string): BuiltInStorePage | null {
  return BUILTIN_STORE_PAGES.find((p) => p.slug === slug) ?? null;
}
