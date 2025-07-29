# Flask Modernization - Manual Testing Guide

This guide provides step-by-step instructions for testing the modernized Flask Book Generator system with Next.js frontend integration.

## Prerequisites

Before testing, ensure you have:
- Python 3.11+ installed
- Node.js 18+ installed
- All environment variables configured
- Supabase project set up
- Gemini API key configured

## System Architecture Overview

The modernized system consists of:
1. **Next.js Frontend** (Port 3000) - User interface
2. **Flask API Backend** (Port 5000) - Book generation service
3. **Supabase** - Database and file storage
4. **Gemini API** - AI content generation

## Step-by-Step Testing Process

### Phase 1: Environment Setup and Validation

#### 1.1 Validate Backend Configuration

```bash
# Navigate to backend directory
cd backend

# Activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Validate environment configuration
python deployment.py validate
```

**Expected Output:**
```
Environment: development
Valid: True
Configuration Status:
  ✅ config_validation: passed
  ✅ environment_variables: passed
  ✅ supabase_storage: passed
  ✅ gemini_api: passed
```

#### 1.2 Test Supabase Storage Connection

```bash
# Test storage integration
python test_supabase_storage.py
```

**Expected Output:**
```
🧪 Testing Supabase Storage Integration...
✅ Storage service initialized successfully
✅ File uploaded successfully
✅ File exists: True
✅ Signed URL generated
✅ File deleted: True
🎉 All tests passed! Supabase Storage integration is working correctly.
```

#### 1.3 Setup Storage Bucket

```bash
# Create the books storage bucket
python setup_storage_bucket.py
```

**Expected Output:**
```
🔧 Setting up Supabase Storage bucket...
✅ Connected to Supabase
📁 Creating 'books' storage bucket...
✅ Books bucket created successfully!
🎉 Storage bucket setup complete!
```

### Phase 2: Backend API Testing

#### 2.1 Start Flask Development Server

```bash
# In backend directory
export FLASK_ENV=development
export FLASK_DEBUG=true
export CORS_ORIGINS=http://localhost:3000
python app.py
```

**Expected Output:**
```
2025-01-XX XX:XX:XX - __main__ - INFO - Initialized Flask Book Generator API v1.0.0
2025-01-XX XX:XX:XX - __main__ - WARNING - Running in DEVELOPMENT mode - not suitable for production
 * Running on http://0.0.0.0:5000
 * Debug mode: on
```

#### 2.2 Test API Health Check

Open a new terminal and test the health endpoint:

```bash
curl http://localhost:5000/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-XX...",
  "version": "1.0.0",
  "service": "flask-book-generator",
  "dependencies": {
    "supabase": true,
    "gemini_api": true,
    "storage": true
  }
}
```

#### 2.3 Test API Endpoints (Without Authentication)

Test the root endpoint:
```bash
curl http://localhost:5000/
```

**Expected Response:**
```json
{
  "service": "Flask Book Generator API",
  "version": "1.0.0",
  "status": "operational",
  "endpoints": {
    "health": "/api/health",
    "generate_book": "/api/generate-book",
    "book_status": "/api/book-status/<book_id>",
    "book_files": "/api/book-files/<book_id>",
    "delete_book": "/api/book-delete/<book_id>"
  }
}
```

### Phase 3: Frontend Setup and Testing

#### 3.1 Setup Frontend Environment

Open a new terminal:

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Check if environment variables are set
cat .env.local
```

**Required Environment Variables in `.env.local`:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_FLASK_API_URL=http://localhost:5000
```

#### 3.2 Start Next.js Development Server

```bash
# In frontend directory
npm run dev
```

**Expected Output:**
```
  ▲ Next.js 14.x.x
  - Local:        http://localhost:3000
  - Ready in 2.1s
```

### Phase 4: End-to-End Integration Testing

#### 4.1 Access the Application

1. Open your browser and navigate to: `http://localhost:3000`
2. You should see the Next.js application
3. Sign in with your Supabase authentication

#### 4.2 Test Book Generation Flow

**Step 1: Navigate to Book Generation**
- Look for the book generation form on the dashboard
- You should see fields for:
  - Book Title
  - Author Name
  - Book Type (fixed to "non-fiction")

**Step 2: Fill Out the Form**
- Enter a test book title (e.g., "The Complete Guide to AI")
- Enter an author name (e.g., "John Doe")
- Click "Generate Book"

**Step 3: Monitor Progress**
- You should see a progress bar appear
- Progress updates should show:
  - "Starting book generation..."
  - "Generating book outline..."
  - "Outline generated successfully"
  - "Generating chapters..."
  - "Creating PDF file..."
  - "Creating EPUB file..."
  - "Generating marketing metadata..."
  - "Book generation completed successfully!"

**Step 4: Verify Backend Logs**
In your Flask terminal, you should see logs like:
```
INFO - Started book generation for user xxx: 'The Complete Guide to AI'
INFO - Status update for xxx: Generating book outline... (10%)
INFO - Status update for xxx: Outline generated successfully (20%)
...
INFO - Successfully completed book generation for 'The Complete Guide to AI'
```

#### 4.3 Test File Downloads

Once generation is complete:

**Step 1: Download Files**
- Click "Download PDF" button
- Click "Download EPUB" button  
- Click "Download Metadata" button

**Step 2: Verify Downloads**
- Check your Downloads folder
- Verify files are downloaded with correct names
- Open PDF file to verify content
- Open EPUB file in an e-reader to verify format

#### 4.4 Test Book Management

**Step 1: View Recent Books**
- Check that your generated book appears in the "Recent Books" section
- Verify book status shows as "Completed"
- Verify creation date is correct

**Step 2: Test Individual Downloads**
- Click individual download buttons (PDF, EPUB, Meta) in the book list
- Verify files download correctly

**Step 3: Test Book Deletion**
- Click "Delete" button on a book
- Confirm deletion in the popup
- Verify book is removed from the list
- Check Flask logs for deletion confirmation

### Phase 5: Error Handling Testing

#### 5.1 Test Validation Errors

**Invalid Input Testing:**
- Try submitting empty title → Should show validation error
- Try submitting very long title (>200 chars) → Should show validation error
- Try submitting empty author → Should show validation error

#### 5.2 Test Authentication Errors

**Unauthenticated Access:**
- Sign out of the application
- Try to access book generation → Should redirect to login

#### 5.3 Test Rate Limiting

**Rate Limit Testing:**
- Generate multiple books quickly
- After 5 books in an hour, you should see rate limit error
- Error should show retry-after information

### Phase 6: API Direct Testing (Advanced)

#### 6.1 Get Authentication Token

In browser console on authenticated page:
```javascript
// Get Supabase session
const { data: { session } } = await supabase.auth.getSession();
console.log('Token:', session.access_token);
```

#### 6.2 Test API Endpoints Directly

**Generate Book:**
```bash
curl -X POST http://localhost:5000/api/generate-book \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "title": "Test Book API",
    "author": "API Tester",
    "book_type": "non-fiction"
  }'
```

**Check Status:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  http://localhost:5000/api/book-status/BOOK_ID_HERE
```

**Get File URLs:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  http://localhost:5000/api/book-files/BOOK_ID_HERE
```

### Phase 7: Performance and Load Testing

#### 7.1 Concurrent Generation Testing

- Open multiple browser tabs
- Start book generation in each tab simultaneously
- Verify all generations complete successfully
- Check for any race conditions or errors

#### 7.2 Large Content Testing

- Generate a book with a very long title (near 200 char limit)
- Generate a book with a complex topic that might produce longer content
- Verify generation completes within reasonable time

### Troubleshooting Common Issues

#### Backend Issues

**Flask Server Won't Start:**
```bash
# Check environment variables
python deployment.py validate

# Check port availability
lsof -i :5000

# Check logs for specific errors
python app.py
```

**Supabase Connection Issues:**
```bash
# Test storage connection
python test_supabase_storage.py

# Check environment variables
echo $SUPABASE_URL
echo $SECRET_KEY
```

**Gemini API Issues:**
```bash
# Check API key
echo $GEMINI_API_KEY

# Test API key format (should be long string starting with 'AI')
```

#### Frontend Issues

**Next.js Won't Start:**
```bash
# Clear cache and reinstall
rm -rf .next node_modules
npm install
npm run dev
```

**API Connection Issues:**
```bash
# Check environment variables
cat .env.local

# Verify Flask API is running
curl http://localhost:5000/api/health
```

**Authentication Issues:**
- Verify Supabase project configuration
- Check that user is properly authenticated
- Verify JWT token is being sent in requests

#### CORS Issues

**CORS Errors in Browser:**
- Check Flask CORS configuration
- Verify `CORS_ORIGINS` includes `http://localhost:3000`
- Check browser network tab for preflight requests

### Success Criteria

✅ **Backend Health Check Passes**
✅ **Frontend Loads Successfully**  
✅ **User Can Authenticate**
✅ **Book Generation Completes Successfully**
✅ **Progress Updates Work in Real-Time**
✅ **All File Types Download Correctly (PDF, EPUB, Metadata)**
✅ **Book Management Functions Work (View, Delete)**
✅ **Error Handling Works Properly**
✅ **Rate Limiting Functions Correctly**
✅ **CORS Configuration Allows Frontend Access**

### Next Steps After Successful Testing

1. **Production Deployment**: Follow the deployment guide for production setup
2. **Monitoring Setup**: Configure logging and monitoring
3. **Performance Optimization**: Based on testing results
4. **User Acceptance Testing**: Have end users test the system
5. **Documentation Updates**: Update any documentation based on testing findings

## Quick Test Commands Summary

```bash
# Terminal 1: Backend
cd backend
source venv/bin/activate
python deployment.py validate
python test_supabase_storage.py
python setup_storage_bucket.py
python app.py

# Terminal 2: Frontend  
cd frontend
npm install
npm run dev

# Terminal 3: Testing
curl http://localhost:5000/api/health
# Open browser to http://localhost:3000
```

This completes the comprehensive testing process for the modernized Flask Book Generator system!