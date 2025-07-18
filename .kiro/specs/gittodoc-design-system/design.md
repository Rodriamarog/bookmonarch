# Design Document

## Overview

BookMonarch will be built as a modern Next.js application following the Gittodoc design philosophy - clean, approachable, and delightfully simple. The design emphasizes clarity over complexity, using strategic color accents and playful geometric elements to create an interface that makes AI book generation feel accessible and engaging.

## Gittodoc Design Philosophy

The visual design will embody these core principles observed from Gittodoc:

### Visual Hierarchy & Typography
- **Clean, bold typography**: Large, readable headings with clear size hierarchy
- **Generous white space**: Ample breathing room around elements
- **Modern sans-serif fonts**: Professional yet approachable typeface selection
- **Strategic emphasis**: Bold weights for key information, regular weights for body text

### Color Palette & Accents
- **Primary coral/salmon**: Warm, inviting primary color (#FF6B6B or similar)
- **Mint green accents**: Fresh contrast color (#4ECDC4 or similar) for secondary elements
- **Neutral foundation**: Clean whites and warm grays for backgrounds
- **Purposeful color usage**: Color serves function, not decoration

### Geometric Elements & Visual Interest
- **Subtle accent shapes**: Small stars, diamonds, and geometric elements as visual punctuation
- **Strategic placement**: Decorative elements complement content without distraction
- **Consistent styling**: Geometric elements follow the same color palette and sizing principles

### Interactive Design
- **Rounded corners**: Soft, approachable button and card styling
- **Clear hover states**: Subtle feedback on interactive elements
- **Generous touch targets**: Mobile-friendly interaction areas
- **Intuitive navigation**: Clear visual cues for user actions

## Architecture

### Frontend Stack
- **Next.js 14+** with App Router for modern React development
- **TypeScript** for type safety and developer experience
- **Tailwind CSS** for utility-first styling and responsive design
- **Shadcn/ui** components styled to match Gittodoc aesthetic

### Backend & Services
- **Supabase** for authentication, database, and file storage
- **Stripe** for subscription billing and payment processing
- **Google Gemini 2.0 Flash** for AI book generation
- **Vercel** for deployment and hosting

### Database Schema (Existing Supabase Schema)
```sql
-- Profiles table (extends Supabase auth.users)
profiles (
  id: uuid PRIMARY KEY,
  created_at: timestamp with time zone DEFAULT now(),
  updated_at: timestamp with time zone DEFAULT now(),
  full_name: text,
  avatar_url: text,
  subscription_status: text DEFAULT 'free',
  books_generated_today: integer DEFAULT 0,
  last_generation_date: date,
  stripe_customer_id: text,
  free_book_used: boolean DEFAULT false -- Track if user used their free book
)

-- Books table
books (
  id: uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id: uuid REFERENCES profiles(id), -- NULL for anonymous books
  created_at: timestamp with time zone DEFAULT now(),
  title: text NOT NULL,
  author_name: text NOT NULL,
  genre: text NOT NULL,
  plot_summary: text,
  writing_style: text,
  chapter_titles: jsonb,
  total_chapters: integer DEFAULT 1,
  status: text DEFAULT 'pending',
  progress: numeric,
  content_url: text,
  tokens_consumed: integer,
  error_message: text,
  access_token: text, -- For anonymous access to books
  is_anonymous: boolean DEFAULT false,
  expires_at: timestamp with time zone -- Anonymous books expire after 24 hours
)

-- Billing events for Stripe webhook processing
billing_events (
  id: uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id: uuid REFERENCES profiles(id),
  stripe_event_id: text NOT NULL,
  event_type: text NOT NULL,
  payload: jsonb NOT NULL,
  processed_at: timestamp with time zone DEFAULT now(),
  processing_status: text DEFAULT 'pending',
  error_message: text
)
```

**Note**: The existing schema will need to be extended to support:
- Multiple file formats: `docx_file_path`, `epub_file_path`, `pdf_file_path`, `metadata_pdf_path`
- Anonymous book generation: `access_token`, `is_anonymous`, `expires_at` fields
- Free book tracking: `free_book_used` field in profiles table

## Components and Interfaces

### Core Pages
1. **Landing Page**: Hero section with clear value proposition, pricing, and CTA
2. **Dashboard**: Generation quota, recent books, quick generation form
3. **Book Library**: Grid/list view of generated books with download options
4. **Generation Form**: Multi-step form for book creation
5. **Account Settings**: Subscription management, billing, profile

### Key Components

#### BookGenerationForm
```typescript
interface BookGenerationForm {
  title: string;
  subtitle?: string;
  author: string;
  genre: string;
  description?: string;
  chapterCount: number; // 1-20
  writingStyle?: string;
  targetAudience?: string;
}
```

#### BookCard
```typescript
interface BookCard {
  id: string;
  title: string;
  author: string;
  genre: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  createdAt: Date;
  downloadLinks?: {
    docx: string;
    epub: string;
    pdf: string;
    metadata: string;
  };
}
```

#### SubscriptionStatus
```typescript
interface SubscriptionStatus {
  isActive: boolean;
  currentPeriodEnd: Date;
  dailyGenerationsUsed: number;
  dailyGenerationsLimit: number;
  billingPortalUrl: string;
}
```

## Data Models

### Book Generation Pipeline
1. **Input Validation**: Validate user input and check daily limits
2. **AI Plot Generation**: Generate overall plot and structure using Gemini
3. **Chapter Planning**: Create chapter titles and outlines
4. **Content Generation**: Generate full chapter content
5. **Format Conversion**: Create DOCX, EPUB, and PDF versions
6. **Metadata Generation**: Create KDP-ready metadata PDF
7. **File Storage**: Upload all files to Supabase storage
8. **Notification**: Notify user of completion

### File Storage Structure
```
/books/{user_id}/{book_id}/
  ├── book.docx
  ├── book.epub
  ├── book.pdf
  └── metadata.pdf
```

## Error Handling

### Generation Failures
- **Timeout handling**: Set reasonable timeouts for AI generation
- **Retry logic**: Automatic retry for transient failures
- **Graceful degradation**: Partial generation recovery
- **User notification**: Clear error messages and next steps

### Payment & Subscription Errors
- **Stripe webhook handling**: Reliable subscription status updates
- **Failed payment recovery**: Clear communication and retry options
- **Access control**: Immediate restriction on subscription lapse

### Rate Limiting
- **Daily generation limits**: Enforce 10 books per day per user
- **API rate limiting**: Protect against abuse
- **Graceful limit messaging**: Clear communication when limits reached

## Testing Strategy

### Unit Testing
- **Component testing**: React Testing Library for UI components
- **Utility function testing**: Jest for business logic
- **API route testing**: Test Next.js API routes

### Integration Testing
- **Database operations**: Test Supabase queries and mutations
- **File operations**: Test file upload/download workflows
- **Payment flows**: Test Stripe integration (using test mode)

### End-to-End Testing
- **User journeys**: Complete book generation workflow
- **Authentication flows**: Sign up, sign in, subscription management
- **Cross-browser testing**: Ensure compatibility across devices

### Performance Testing
- **Load testing**: Test concurrent book generation
- **File size optimization**: Ensure reasonable download sizes
- **Page speed optimization**: Core Web Vitals compliance

## Design System Implementation

### Tailwind Configuration
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef2f2',
          500: '#ff6b6b', // Coral/salmon
          600: '#e55555',
        },
        accent: {
          50: '#f0fdfa',
          500: '#4ecdc4', // Mint green
          600: '#3bb5ac',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      }
    }
  }
}
```

### Component Styling Patterns
- **Cards**: `bg-white border border-gray-200 rounded-xl shadow-sm`
- **Buttons**: `bg-primary-500 hover:bg-primary-600 text-white rounded-lg px-6 py-3`
- **Inputs**: `border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500`
- **Accent elements**: Positioned absolutely with `text-accent-500` geometric icons