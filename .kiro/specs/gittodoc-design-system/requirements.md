# Requirements Document

## Introduction

BookMonarch is a subscription-based SaaS platform that enables users to generate full-length, AI-powered books quickly and efficiently. Users pay $20/month to generate up to 10 books per day using Google Gemini 2.0 Flash AI. The platform handles everything from plot generation to chapter creation, requiring only basic input from users like title, author, and genre.

## Requirements

### Requirement 1

**User Story:** As a user, I want to immediately access the book generation interface when I visit the site, so that I can start creating books without friction.

#### Acceptance Criteria

1. WHEN a user visits the homepage THEN the system SHALL display the book generation dashboard directly
2. WHEN a user enters book details and clicks generate THEN the system SHALL start book generation immediately
3. WHEN a user clicks sign up THEN the system SHALL provide email/password and Google OAuth registration options
4. WHEN a user completes registration THEN the system SHALL remain on the dashboard with their session active

### Requirement 8

**User Story:** As a potential customer, I want to try the service with one free book generation, so that I can experience the quality before subscribing.

#### Acceptance Criteria

1. WHEN an anonymous user generates a book THEN the system SHALL allow the generation to complete without requiring authentication
2. WHEN an anonymous user's book generation completes THEN the system SHALL store the book temporarily with a unique access token
3. WHEN an anonymous user attempts to download their generated book THEN the system SHALL prompt them to sign up or sign in
4. WHEN a user signs up after generating a free book THEN the system SHALL associate the generated book with their account
5. WHEN a user signs in after generating a free book THEN the system SHALL associate the generated book with their account if they haven't used their free generation
6. WHEN a user has already used their free generation THEN the system SHALL not allow additional free generations

### Requirement 2

**User Story:** As a subscriber, I want to manage my subscription and billing, so that I can control my account and payments.

#### Acceptance Criteria

1. WHEN a user subscribes THEN the system SHALL process payment through Stripe for $20/month
2. WHEN a user accesses account settings THEN the system SHALL display current subscription status and billing history
3. WHEN a user cancels subscription THEN the system SHALL maintain access until the current billing period ends
4. WHEN subscription expires THEN the system SHALL restrict book generation access

### Requirement 3

**User Story:** As a user, I want to generate books by providing minimal information, so that I can create content without extensive planning.

#### Acceptance Criteria

1. WHEN a user accesses book generation THEN the system SHALL require book title, author name, and book type (Non-fiction only for MVP)
2. WHEN a user provides optional writing style THEN the system SHALL incorporate it into the generation process
3. WHEN a user submits book details THEN the system SHALL validate daily generation limit (1 for free, 10 for pro)
4. WHEN generation starts THEN the system SHALL display real-time progress with current stage information
5. WHEN books are generated THEN they SHALL contain exactly 15 chapters with 800-1200 words each

### Requirement 9

**User Story:** As a user, I want the AI to generate high-quality, coherent books through a structured process, so that the output is professional and well-organized.

#### Acceptance Criteria

1. WHEN book generation starts THEN the system SHALL first generate a comprehensive outline with plot summary and 15 chapter titles
2. WHEN the outline is complete THEN the system SHALL generate each chapter sequentially, maintaining continuity between chapters
3. WHEN generating each chapter THEN the system SHALL use context from all previous chapters to ensure coherence
4. WHEN a chapter is generated THEN the system SHALL save it to secure storage and update progress indicators
5. WHEN all chapters are complete THEN the system SHALL compile them into a complete book file
6. WHEN generation fails at any stage THEN the system SHALL provide clear error messages and cleanup partial content

### Requirement 4

**User Story:** As a user, I want my generated books to be properly formatted in multiple formats, so that I can use them for different publishing platforms.

#### Acceptance Criteria

1. WHEN book generation completes THEN the system SHALL create books with 1-20 chapters as specified
2. WHEN books are generated THEN the system SHALL provide the book in three formats: DOCX (editable), EPUB (e-reader), and PDF (print-ready)
3. WHEN books are generated THEN the system SHALL store all formats securely in Supabase storage
4. WHEN a user views their library THEN the system SHALL display all generated books with download options for each format

### Requirement 7

**User Story:** As a user, I want to receive comprehensive metadata for Amazon KDP publishing, so that I can easily publish my books without additional research.

#### Acceptance Criteria

1. WHEN book generation completes THEN the system SHALL generate a metadata PDF containing all Amazon KDP required fields
2. WHEN metadata is generated THEN it SHALL include title, subtitle, author, book description, back-cover summary
3. WHEN metadata is generated THEN it SHALL include 3 relevant BISAC categories and 7 SEO keywords
4. WHEN metadata is generated THEN it SHALL include additional KDP fields like target audience, content warnings if applicable, and suggested pricing tier
5. WHEN a user downloads their book THEN the system SHALL provide both the book files and the metadata PDF as a complete package

### Requirement 5

**User Story:** As a user, I want to track my usage and manage my generated content, so that I can stay within limits and organize my work.

#### Acceptance Criteria

1. WHEN a user accesses the dashboard THEN the system SHALL display daily generation count and remaining quota
2. WHEN a user generates a book THEN the system SHALL decrement their daily counter
3. WHEN daily limit is reached THEN the system SHALL prevent further generation until reset at midnight
4. WHEN a user views their library THEN the system SHALL allow sorting, searching, and organizing books

### Requirement 6

**User Story:** As a user, I want the application to be fast and responsive, so that I can work efficiently across different devices.

#### Acceptance Criteria

1. WHEN the application loads THEN it SHALL render within 2 seconds on standard connections
2. WHEN users interact with the interface THEN it SHALL provide immediate feedback and smooth transitions
3. WHEN accessed on mobile devices THEN the system SHALL display a fully responsive layout
4. WHEN book generation is in progress THEN the system SHALL allow users to continue using other features