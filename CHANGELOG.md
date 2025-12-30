# Changelog

All notable changes to the AI-Dictionary project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### December 30, 2025

#### Changed - PR #59: Update Next.js to 16.0.10

- **Dependencies:**
  - Updated Next.js from 16.0.7 to 16.0.10 in frontend package

### December 24, 2025

#### Added - PR #57: Add docstrings to `auth/frontend`

- **Backend Documentation:**
  - Added comprehensive docstrings to `users.py` for `get_user_manager()` and `get_jwt_strategy()` functions
  - Documented JWT configuration details (SECRET, 3600s lifetime)
  
- **Frontend Documentation:**
  - Added JSDoc comments for all pages: `RootLayout`, `Home`, `About`, `Login`, `Signup`, and `BlogPostPage`
  - Documented auth-state handling and redirect behavior in login/signup pages
  - Added component documentation for `Navbar`, `AuthContext`, `LoginForm`, and `SignupForm`
  - Documented new API functions: `loginUser()`, `handleSignup()`, `getCurrentUser()`, and `logoutUser()`

- **Frontend UI Enhancement:**
  - Added pathname-based `isAuthPage` check in Navbar to hide it on `/login` and `/signup` pages

### December 23, 2025

#### Added - PR #56: Cookie-based Authentication and User Context Management

- **Backend Security:**
  - Migrated JWT transport from Bearer tokens to httpOnly cookies
  - Implemented `CookieTransport` with secure configuration (3600s max age, secure flag, SameSite=none)
  - Changed auth router mount path from `/auth/jwt` to `/auth/cookie`

- **Frontend Auth Architecture:**
  - Created centralized `AuthContext` for application-wide authentication state management
  - Added `useAuth()` hook with actions: `loginAction`, `logoutAction`, `registerAction`
  - Implemented automatic session restoration via `getCurrentUser()` on mount

- **Frontend API Updates:**
  - Updated all auth endpoints to use cookie-based authentication
  - Added `credentials: "include"` to all authenticated requests
  - Implemented new API functions: `getCurrentUser()` and `logoutUser()`
  - Removed client-side token management and localStorage usage

- **Frontend Layout:**
  - Consolidated Navbar into app layout with `AuthProvider` wrapper
  - Implemented conditional Navbar rendering (hidden on auth pages)
  - Added authentication state display in navigation

#### Fixed

- Removed per-page Navbar imports for better maintainability
- Improved error parsing in API calls
- Enhanced security by migrating from localStorage tokens to httpOnly cookies

### December 22, 2025

#### Added - PR #55: Code Formatting and Linting Infrastructure

- **Development Tools:**
  - Integrated Ruff (v0.14.10+) as dev dependency for Python linting and formatting
  - Added pre-commit hooks for automatic code quality checks (`ruff-check`, `ruff-format`)
  - Configured Ruff lint rules for error detection (E), pyflakes (F), and bugbear (B)

- **Code Quality Improvements:**
  - Added input validation to `ProductHuntWrapper` constructor with `ValueError` on invalid tokens
  - Implemented exception chaining with `raise ... from e` in database repository methods
  - Added comprehensive docstrings to Product Hunt wrapper modules
  - Modernized type hints using built-in generics (`dict[str, Any]` instead of `typing.Dict`)

#### Changed

- **Logging Architecture:**
  - Removed unused `backend/core/logging.py` file
  - Centralized logging configuration in `backend/main.py` with `logging.basicConfig`
  - Standardized logger initialization using `logging.getLogger(__name__)`

- **Code Formatting:**
  - Standardized import ordering across all backend modules
  - Normalized string quoting and trailing newlines
  - Added `# noqa: B008` annotations for FastAPI dependency injection patterns

- **Product Hunt Wrapper:**
  - Switched to explicit UTC datetime for date calculations
  - Enhanced error handling with HTTP status code validation
  - Reformatted GraphQL queries for better readability

#### Removed

- Deleted unused re-exported imports in `backend/services/authentication/users.py`

### December 20, 2025

#### Added - PR #54: Atomic Post Insertion with PostgreSQL RPC

- **Database Layer:**
  - Created PostgreSQL RPC function `create_post_with_content(post_json jsonb, post_content_json jsonb)`
  - Implemented atomic transaction for simultaneous post and content insertion
  - Added database migration: `20251219190622_create_post_function.sql`
  - Created "admin policy" on `post_content` table for supabase_admin and supabase_storage_admin

#### Changed

- Updated `posts_repo.py` `add_post()` method to use RPC instead of separate inserts
- Enhanced error handling to prevent orphaned posts on partial failures

### December 19, 2025

#### Added - PR #51: Repository Layer for Data Access

- **Database Client:**
  - Created centralized Supabase client initialization in `backend/db/client.py`
  - Implemented environment variable validation for `SUPABASE_URL` and `SUPABASE_KEY`
  - Exposed public constants: `url`, `key`, and `supabase` client instance

- **Repository Pattern:**
  - Implemented `posts_repo.py` with comprehensive data access methods:
    - `add_post(post, post_content)` - Insert post with content
    - `get_post_by_id(post_id)` - Retrieve post by ID
    - `get_post_content_by_id(post_id)` - Retrieve post content
    - `user_liked_post(user_id, post_id)` - Handle user likes with duplicate detection
  - Added explicit error handling for all database operations
  - Included TODO for enforcing unique constraints on user_liked_posts

- **Dependencies:**
  - Added `supabase>=2.27.0` to project dependencies

### December 18, 2025

#### Added - PR #49: Summary Agent and Title Generation Workflow

- **LangGraph Workflow:**
  - Created state graph workflow with nodes: data loading → summary agent → title tool → title update → END
  - Implemented graph compilation with HumanMessage input support
  - Added Mermaid diagram export capability (`summaryagent.png`)

- **AI Model Configuration:**
  - Configured multiple LLM providers:
    - Google Gemini (gemini-2.5-flash)
    - OpenAI (gpt-4o-mini)
    - Groq (qwen3-32b)
  - Implemented `InMemoryRateLimiter` for OpenAI model (0.5 req/sec)
  - Set per-model temperature and retry configurations

- **Agent Implementation:**
  - Created `summaryagent.py` with summary agent using groqmodel
  - Implemented `agentnode.py` for summary generation from state
  - Added `title_node.py` for title extraction from tool messages
  - Created `load_data_node.py` for simulating structured data retrieval

- **Tools and Prompts:**
  - Implemented `title_tool` for generating professional, concise titles (5-7 words)
  - Added prompt templates: `SUMMARY_PROMPT` and `TITLE_PROMPT`
  - Enforced strict single-line output format for title generation

- **State Management:**
  - Defined comprehensive `State` TypedDict schema with fields:
    - user_input, messages, data, topic, title, summary, code

- **Configuration:**
  - Added logging setup in `backend/core/logging.py`
  - Pinned Python runtime to 3.11.4

### December 15, 2025

#### Added - PR #46: Supabase Local Development Setup

- **Infrastructure Configuration:**
  - Created comprehensive `supabase/config.toml` with configuration for:
    - API, Database, Authentication, Storage, Realtime services
    - Studio, Analytics, and Edge Runtime
    - Environment variable placeholders for all services

- **Database Schema:**
  - Migration `20251214023227_initial_schema_setup.sql`:
    - `posts` table: title, source, upload_date, approval_date, likes_count
    - `post_content` table: JSONB-based flexible content storage
    - `users` table: username, name, email, joining_date
    - `user_liked_posts` table: user-to-post like relationships
    - `user_saved_posts` table: user-to-post save relationships
  - Implemented UUID primary keys with auto-generation
  - Added foreign key relationships with referential integrity
  - Granted role-based access for authenticated and service_role users

- **Security:**
  - Migration `20251214030543_add_row_level_security.sql`:
    - Enabled Row-Level Security (RLS) on all tables
    - Enforced row-level data access control

- **Documentation:**
  - Added "DB SETUP" section to README with:
    - Step-by-step Supabase local setup instructions
    - Migration running procedures
    - Optional production database linking guide

- **Development Environment:**
  - Updated `.gitignore` to exclude Supabase artifacts (`.branches`, `.temp`, `.env.*`)

### December 11, 2025

#### Fixed - PR #45: Login API Refactoring

- **API Contract:**
  - Refactored `loginUser()` to accept `LoginPayload` object instead of positional arguments
  - Added TypeScript interfaces: `LoginResponse` and `LoginPayload`

#### Changed

- **HTTP Client Migration:**
  - Replaced axios with fetch API for login and signup flows
  - Implemented runtime response validation with error throwing
  - Added centralized `API_URL` constant for endpoint management
  - Added request/response logging

- **State Management:**
  - Changed user state initialization from `null` to empty string

#### Removed

- Removed unused axios import from API module

### December 8, 2025

#### Added - PR #43: Custom Global 404 Page

- **Error Handling:**
  - Created custom global 404 page (`global-not-found.js`)
  - Implemented themed design with:
    - Responsive two-column layout
    - Custom branding and messaging
    - "Return to Reality" CTA button
    - Manrope font typography
    - Decorative background elements with animations

- **Next.js Configuration:**
  - Enabled experimental `globalNotFound` feature in `next.config.ts`
  - Configured custom 404 page for all unimplemented routes

#### Added - PR #42: Dynamic Blog Post Routing

- **Routing Architecture:**
  - Implemented dynamic route segment: `/blog/[slug]/page.tsx`
  - Created `BLOG_DATABASE` constant mapping slugs to content blocks
  - Supports multiple content block types: title, summary, code, image, explanation, related_topics

- **Blog Post Component:**
  - Created async server component `BlogPostPage`
  - Implemented 404 fallback UI for non-existent posts
  - Added breadcrumb navigation
  - Integrated `ScrollProgress` and `BlockRenderer` components

#### Changed

- Updated Navbar blog links from `/blogs` to `/blog` for consistency

#### Removed

- Deleted legacy static blog post page (`/blogs/post/page.tsx`)
- Removed hardcoded `MOCK_DATA` implementation

### December 7, 2025

#### Added - PR #41: Shiki Code Syntax Highlighting

- **Code Rendering:**
  - Integrated Shiki (v3.19.0) for server-side syntax highlighting
  - Created `CodeBlockClient` component with:
    - Customizable header with filename display
    - Decorative window controls
    - HTML injection via `dangerouslySetInnerHTML`
    - Framer Motion entry animations
    - Horizontal overflow support

- **Scroll Progress:**
  - Created dedicated `ScrollProgress` component
  - Implemented smooth spring animations using Framer Motion hooks
  - Added fixed top positioning with progress bar visualization

- **Type System:**
  - Added optional `filename?: string` property to `CodeBlock.data` type

#### Changed

- **Code Component:**
  - Refactored from synchronous to asynchronous function
  - Implemented server-side HTML generation via `codeToHtml`
  - Added default language fallback to "text"
  - Enhanced error handling

- **Dependencies:**
  - Updated Next.js from 16.0.1 to 16.0.7

- **Client Directives:**
  - Added "use client" to block components: example, explanation, header, image, related-topics, summary

- **Blog Post Page:**
  - Removed client directive from page component
  - Replaced inline scroll progress with `ScrollProgress` component
  - Updated example code block content

### December 6, 2025

#### Added - PR #40: Blog Page Parsing and Rendering System

- **Type System:**
  - Created comprehensive TypeScript content block types (`frontend/types/content.ts`)
  - Implemented discriminated union with block types:
    - `TitleBlock`: post metadata, tags, difficulty, author, estimated time
    - `SummaryBlock`: summary content
    - `CodeBlock`: code snippets with language specification
    - `ImageBlock`: images with alt text, caption, URL
    - `DiagramBlock`: placeholder for future implementation
    - `ExplanationBlock`: detailed explanations
    - `ExampleBlock`: examples with optional title
    - `RelatedTopicsBlock`: topic tags array
  - Created `AllContentBlock` union type for type-safe rendering

- **Block Renderer:**
  - Implemented `BlockRenderer` component with `BLOCK_REGISTRY` mapping
  - Added automatic component resolution by block type
  - Created empty state UI with animated GIF
  - Implemented environment-aware error handling:
    - Development: red warning banners for unknown types
    - Production: silent null rendering

- **Block Components:**
  - **Header Block**: Post metadata with title, author, date, read time, difficulty
    - Tag pills with responsive layout
    - Lucide-react icons integration
    - Framer Motion animations
  - **Summary Block**: Animated italic paragraph with fade/slide effects
  - **Code Block**: Styled container with header and status indicators
  - **Image Block**: Bordered container with grid background pattern
  - **Explanation Block**: "Deep Dive" section with animations
  - **Example Block**: "Cookbook & Examples" with action button
  - **Related Topics Block**: Interactive topic pills with hover states

- **Blog Post Page:**
  - Created client-side blog post page with mock data
  - Implemented scroll progress indicator
  - Added fixed navigation with breadcrumb trail
  - Integrated BlockRenderer for content orchestration

#### Changed

- Updated Navbar blog link from `/blog` to `/blogs`

### December 5, 2025

#### Changed - PR #38: Documentation Update

- Updated README to mark Authentication feature as completed

### December 3, 2025

#### Fixed - PR #37: Authentication Navigation Routes

- Updated login form "Sign up" link to point to `/signup` (was placeholder "#")
- Changed signup form "Sign in" link to `/login` (was `/signin`)
- Ensured consistency in authentication route naming

#### Added - PR #35: Complete Authentication Service

- **Backend Architecture:**
  - Refactored from app-based to router-based authentication
  - Replaced FastAPI app mounting with APIRouter pattern
  - Implemented lifespan context management for startup/shutdown
  - Updated server to use module reference with hot reload

- **Frontend Registration:**
  - Implemented complete signup form with client-side state management
  - Added form submission handler with API integration
  - Implemented error handling and success feedback
  - Configured automatic redirect to login on successful registration

- **API Integration:**
  - Created `handleSignup()` function with TypeScript interfaces
  - Implemented POST to `/auth/register` with JSON payload
  - Added comprehensive error handling with fallback messages
  - Fixed authentication endpoint URL from `/auth/auth/jwt/login` to `/auth/jwt/login`

- **Dependencies:**
  - Updated `baseline-browser-mapping` to version 2.8.32

#### Added - PR #33: User Authentication with Login Functionality

- **Backend Configuration:**
  - Implemented FastAPI application instance
  - Configured CORS middleware with environment-driven origins
  - Mounted authentication sub-application at `/auth` endpoint
  - Set up uvicorn server (127.0.0.1:8000)

- **Frontend API Integration:**
  - Created `loginUser()` async function
  - Implemented OAuth2 password grant flow with URL-encoded form data
  - Added error handling with logging

- **Frontend Login Component:**
  - Implemented `handleLoginSubmit()` function
  - Added loading state management
  - Integrated Next.js router for post-login navigation
  - Implemented token storage in localStorage

- **Dependencies:**
  - Added axios package (v1.13.2)

### November 29, 2025

#### Added - PR #28: Product Hunt API Wrapper

- **API Integration:**
  - Created `ProductHuntWrapper` class for Product Hunt API interaction
  - Implemented methods:
    - `get_top_products_topic_ai()`: Fetch AI topic products
    - `get_top_products_topic_developer_tools()`: Fetch developer tools products
  - Added helper functions:
    - `date_check()`: Generate yesterday's date in ISO format
    - `url_call()`: Perform authenticated GraphQL API requests
  - Implemented comprehensive error handling with token validation

- **Testing:**
  - Added test suite (`test_ph_wrapper.py`) with unit tests
  - Implemented environment variable loading via python-dotenv
  - Created test cases for AI and developer-tools queries

- **Configuration:**
  - Added `.gitignore` for Python artifacts (venv/, **pycache**, *.pyc, etc.)
  - Added `python-dotenv>=1.2.1` dependency

- **Security:**
  - Implemented secure credential handling through environment variables

### November 23, 2025

#### Added - PR #24: Refined LangGraph Bot Structure

- Reorganized langgraph_bot directory with clear component separation:
  - `nodes/`: Node implementations
  - `prompts/`: Prompt templates
  - `agentschema/`: Schema definitions
  - `model/`: Model configurations
- Established clean architecture for building agentic workflows

### November 22, 2025

#### Added - PR #20: Backend Project Structure

- **Directory Structure:**
  - Created `API/`: API endpoints implementation
  - Created `CORE/`: Configuration and core utilities
    - `config.py`: User-related and environment configuration
    - `logging.py`: Logging functionality
  - Created `MODEL/`: Data models and Pydantic validation
  - Created `SERVICES/`: Business logic modules

- **Documentation:**
  - Added `rule.md` with folder responsibilities and best practices
  - Created note files with implementation guidelines
  - Linked to FastAPI best practice resources

### November 21, 2025

#### Added - PR #19: About Page Navigation

- Added Navbar to About page for consistency across the application
- Enhanced about page with background styling

#### Added - PR #17: About Page Skeleton

- Created initial structure for About Us page
- Added basic page layout and components

#### Added - PR #16: Theme Provider Component

- Implemented theme provider component for dark/light mode support
- Set up foundation for application-wide theming

### November 18, 2025

#### Changed - PR #15: Next.js Image Component Migration

- Replaced standard `<img>` tags with Next.js `<Image>` component
- Improved performance with automatic image optimization
- Example implementation:

  ```typescript
  <Image
    src="/undraw_ai-agent_pdkp.svg"
    width={500}
    height={500}
    alt="AI Agent illustration"
  />
  ```

### November 15, 2025

#### Added - PR #13: Authentication UI and Landing Page Improvements

- **Authentication Pages:**
  - Created `LoginPage` and `SignupPage` with branded layouts
  - Implemented `LoginForm` and `SignupForm` components with:
    - Structured form fields
    - Social login buttons
    - Validation hints
    - Inter-page navigation links

- **UI Components:**
  - Created reusable Card component set:
    - `Card`, `CardHeader`, `CardContent`, `CardFooter`
  - Established consistent form and modal layouts

- **Landing Page Design:**
  - Updated background colors for modern, darker aesthetic
  - Improved hero section layout with new illustration
  - Enhanced animation transitions for hero image
  - Updated button colors for better contrast
  - Fixed HTML encoding issues (apostrophes)
  - Adjusted posts section background and spacing

- **Navbar Enhancements:**
  - Refined shrinking behavior on scroll
  - Added smooth blur effects with transitions
  - Updated sizing for sleeker appearance

---

## Notes

- This changelog covers changes from commit `938a103` (November 15, 2025) to the latest commit `ef21b1c` (December 24, 2025)
- All dates are in IST (Indian Standard Time)
- For detailed technical implementation notes, refer to individual PR descriptions in the upstream repository
