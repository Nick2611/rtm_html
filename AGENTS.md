# RTM Pantallas LED: Mandatory Editing Rules

Read this file in full before modifying the site's code, content, or styles. Every change must preserve the visual, editorial, and conversion structure defined here.

## 1. Guiding Principle

The site must feel sober, technical, and trustworthy. Conversion comes from clear hierarchy, real projects, and easy contact, not from an accumulation of banners, pop-ups, badges, or repeated calls to action.

Use contemporary industrial sites such as Cirrus LED as a conceptual reference: a clear promise, few actions, a visible product, real proof, and well-spaced sections. Do not copy third-party copy, identity, or components.

## 2. Required Commercial Page Structure

Respect this order whenever the page includes these sections:

1. Header: navigation and one commercial CTA.
2. Hero: one H1, a brief explanation, and up to two actions.
3. Offer: products, services, or use cases presented without repeating the hero promise.
4. Proof: real clients or projects. Client logos appear only once across the entire homepage.
5. Arguments: up to four concrete benefits, only when they add new information.
6. Contact: contextual WhatsApp link or a short form.
7. Footer: contact details and secondary navigation.

Do not insert new bands between these sections without demonstrating that they add information or enable a distinct decision.

## 3. Conversion Hierarchy

- Priority 1: speak with an advisor or request a quote.
- Priority 2: view projects or product details.
- A single block may contain one primary CTA and, at most, one secondary CTA.
- Catalog cards have one visible action. Quoting belongs in the product detail page.
- Persistent WhatsApp access must be a single compact pill. On mobile it may span the bottom width; on desktop it must not compete with the content.
- Do not use scroll-triggered pop-ups, promotional modals, duplicate bars, or messages that follow the user.
- Do not duplicate the carousel, client logos, testimonials, or benefits.
- WhatsApp links must contain a short, contextual message.
- Forms require only name, phone/WhatsApp, and need. All other fields remain optional and grouped.

## 4. Visual Language

- Base palette: black/dark gray, white, and the institutional red. Green is reserved for WhatsApp actions.
- Use existing typography, border radii, borders, and spacing before introducing variants.
- Prioritize generous space, clean alignment, and contrast. Avoid cards within cards.
- Do not add gradients, heavy shadows, pills, borders, or decorative icons unless they serve a function.
- Do not use emojis. Font Awesome icons are allowed only when they improve recognition or accessibility.
- Do not add AI-generated illustrations or images. Use real material from products, installations, and clients.
- Prefer WebP for photographs and raster backgrounds. Keep appropriate dimensions and a compatible fallback only when technically necessary.
- Each section must have one visual focus and sufficient whitespace.

## 5. Copy Rules

- Write in clear, natural Spanish for Argentina.
- Make specific, verifiable promises. Do not invent metrics, certifications, timelines, testimonials, or guarantees.
- Avoid generic AI phrasing such as “take your project to the next level,” “innovative solutions,” or repeated uses of “we help you.”
- H1: one idea, preferably across two lines and no more than about 12 words.
- Hero supporting copy: one or two short sentences.
- Section paragraphs: no more than three visual lines on desktop whenever possible.
- Buttons describe the action: “Request a quote,” “Speak with an advisor,” “View projects,” “View product.”
- Do not use all caps except for very short labels in the existing system.

## 6. Technical and Data Rules

- Do not send PII to Microsoft Clarity. Events include only page, section, product, category, origin, and technical status.
- Keep `js/contact-form.js` and `backend/lambda/send-email/` synchronized.
- If the Lambda changes, regenerate `backend/lambda/send-email/send-email.zip` and validate the file.
- Version changed assets to prevent stale cache issues.
- Preserve keyboard navigation, labels, focus states, `aria-label`, `aria-live`, and contrast.
- Do not add dependencies to solve a simple interaction.
- If Microsoft Clarity data is required, there is an mcp server available with the command 'clarity-mcp-server --clarity_api_token=$CLARITY_API_TOKEN, use .zshrc

## 7. Required Workflow Before and After Editing

Before editing:

1. Read this file in full.
2. Review the current diff and distinguish your changes from the user's changes.
3. Inspect the existing section and look for equivalent components before creating a new one.
4. Confirm that the proposed content or CTA is not already present on the page.

After editing:

1. Review desktop and mobile when a browser is available.
2. Run `git diff --check` and syntax validations.
3. Test the form without submitting a real inquiry, unless explicitly authorized.
4. Confirm that no content is covered by fixed elements and that no actions are duplicated.
5. Report any visual validation that could not be performed.

## 8. Completion Criterion

A change is not complete if it increases the number of elements without improving the user's decision. When two alternatives are functionally equivalent, choose the simpler, clearer option that is most consistent with the existing structure.

## AWS Guidance

- Prefer the AWS MCP Server for AWS interactions; it provides sandboxed execution, observability, and audit logging. If unavailable, use the AWS CLI directly.
- Before starting an AWS task, check whether a relevant AWS skill is available. Load the skill with `retrieve_skill` and prefer its guidance over general knowledge.
- When uncertain about specific AWS details (API parameters, permissions, limits, error codes), verify against documentation rather than guessing. State uncertainty explicitly if you cannot confirm.
- When creating infrastructure, prefer infrastructure-as-code (AWS CDK or CloudFormation) over direct CLI commands.
- When working with infrastructure, follow AWS Well-Architected Framework principles.
- Do not use em dashes in AWS resource names or descriptions. Use hyphens instead.

### Secret Safety

- MUST load the `aws-secrets-manager` skill first for any secret, credential, API key, token, or password task. MUST NOT call `secretsmanager get-secret-value` or `batch-get-secret-value`, and MUST NOT hit the Secrets Manager Agent daemon directly. MUST use `{{resolve:secretsmanager:secret-id:SecretString:json-key}}` with `asm-exec` so the secret resolves at runtime without entering context.
