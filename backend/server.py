import os
import asyncio
import random
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pydantic import BaseModel
import tweepy
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

# Environment variables
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
TWITTER_API_KEY = os.environ.get('TWITTER_API_KEY', 'EzIDpcRTVi3OqaavniemqZVCY')
TWITTER_API_SECRET = os.environ.get('TWITTER_API_SECRET', 'cXjVH9CMwxm3ce9brBamqZvhVKqtRr0w9RrPmR8YIoI99ir4yM')
TWITTER_ACCESS_TOKEN = os.environ.get('TWITTER_ACCESS_TOKEN', '1942652349849165824-kYgJW23IJ0OwemoraHDKz28hpXD3Dx')
TWITTER_ACCESS_TOKEN_SECRET = os.environ.get('TWITTER_ACCESS_TOKEN_SECRET', 'J0ZRgrN9L3s8NnkINWhvfNILKE96wP6GL2xkYV1gIdunE')
TWITTER_BEARER_TOKEN = os.environ.get('TWITTER_BEARER_TOKEN', 'AAAAAAAAAAAAAAAAAAAAAHJm3QEAAAAA%2F%2B%2BCptyFov1Tz4axdzoSA0mzyZ8%3DdZGR2YqD7zFDb4oYHAoxAgftrcJN2R1HFJoEx3RJNL0PfkEqHO')

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(title="Twitter Engagement Bot", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
try:
    client = MongoClient(MONGO_URL)
    db = client.twitter_bot
    # Collections
    target_accounts = db.target_accounts
    comments = db.comments
    activity_logs = db.activity_logs
    settings = db.settings
    logger.info("Connected to MongoDB successfully")
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {e}")

# Twitter API Setup
try:
    # Setup Twitter API v2 client
    twitter_client = tweepy.Client(
        bearer_token=TWITTER_BEARER_TOKEN,
        consumer_key=TWITTER_API_KEY,
        consumer_secret=TWITTER_API_SECRET,
        access_token=TWITTER_ACCESS_TOKEN,
        access_token_secret=TWITTER_ACCESS_TOKEN_SECRET,
        wait_on_rate_limit=True
    )
    
    # Setup Twitter API v1.1 for posting (needed for replies)
    auth = tweepy.OAuth1UserHandler(
        TWITTER_API_KEY,
        TWITTER_API_SECRET,
        TWITTER_ACCESS_TOKEN,
        TWITTER_ACCESS_TOKEN_SECRET
    )
    twitter_api_v1 = tweepy.API(auth, wait_on_rate_limit=True)
    
    logger.info("Twitter API clients initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Twitter API: {e}")

# Pydantic models
class TargetAccount(BaseModel):
    id: Optional[str] = None
    username: str
    display_name: Optional[str] = None
    is_active: bool = True
    last_tweet_id: Optional[str] = None
    created_at: Optional[datetime] = None

class Comment(BaseModel):
    id: Optional[str] = None
    text: str
    category: str = "general"  # general, bullish, ironic, provocative
    is_active: bool = True
    usage_count: int = 0
    created_at: Optional[datetime] = None

class BotSettings(BaseModel):
    id: Optional[str] = None
    is_active: bool = True
    comments_per_day: int = 10
    min_delay_minutes: int = 30
    max_delay_minutes: int = 180
    comment_categories: List[str] = ["general", "bullish", "ironic"]
    created_at: Optional[datetime] = None

class ActivityLog(BaseModel):
    id: Optional[str] = None
    target_username: str
    tweet_id: str
    tweet_url: str
    comment_text: str
    status: str  # success, failed, pending
    error_message: Optional[str] = None
    timestamp: Optional[datetime] = None

# Global scheduler
scheduler = AsyncIOScheduler()
bot_running = False

# API Routes
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "bot_running": bot_running}

@app.get("/api/twitter/verify")
async def verify_twitter_connection():
    try:
        me = twitter_client.get_me()
        return {
            "status": "connected",
            "user": {
                "id": me.data.id,
                "username": me.data.username,
                "name": me.data.name
            }
        }
    except Exception as e:
        logger.error(f"Twitter verification failed: {e}")
        raise HTTPException(status_code=500, detail=f"Twitter API connection failed: {str(e)}")

# Target Accounts Management
@app.get("/api/target-accounts")
async def get_target_accounts():
    try:
        accounts = list(target_accounts.find({}, {"_id": 0}))
        return {"accounts": accounts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/target-accounts")
async def add_target_account(account: TargetAccount):
    try:
        # Verify the account exists on Twitter
        try:
            user = twitter_client.get_user(username=account.username)
            account.display_name = user.data.name
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Twitter user @{account.username} not found")
        
        # Check if already exists
        existing = target_accounts.find_one({"username": account.username})
        if existing:
            raise HTTPException(status_code=400, detail="Account already exists")
        
        account.id = str(uuid.uuid4())
        account.created_at = datetime.utcnow()
        
        target_accounts.insert_one(account.dict())
        return {"message": f"Target account @{account.username} added successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/target-accounts/{account_id}")
async def delete_target_account(account_id: str):
    try:
        result = target_accounts.delete_one({"id": account_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Account not found")
        return {"message": "Account deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/target-accounts/{account_id}/toggle")
async def toggle_target_account(account_id: str):
    try:
        account = target_accounts.find_one({"id": account_id})
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        new_status = not account["is_active"]
        target_accounts.update_one(
            {"id": account_id}, 
            {"$set": {"is_active": new_status}}
        )
        
        status = "activated" if new_status else "deactivated"
        return {"message": f"Account {status} successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Comments Management
@app.get("/api/comments")
async def get_comments():
    try:
        comment_list = list(comments.find({}, {"_id": 0}))
        return {"comments": comment_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/comments")
async def add_comment(comment: Comment):
    try:
        comment.id = str(uuid.uuid4())
        comment.created_at = datetime.utcnow()
        
        comments.insert_one(comment.dict())
        return {"message": "Comment added successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/comments/{comment_id}")
async def delete_comment(comment_id: str):
    try:
        result = comments.delete_one({"id": comment_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Comment not found")
        return {"message": "Comment deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Bot Settings
@app.get("/api/settings")
async def get_bot_settings():
    try:
        bot_settings = settings.find_one({}, {"_id": 0})
        if not bot_settings:
            # Create default settings
            default_settings = BotSettings(
                id=str(uuid.uuid4()),
                created_at=datetime.utcnow()
            )
            settings.insert_one(default_settings.dict())
            return {"settings": default_settings.dict()}
        return {"settings": bot_settings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/settings")
async def update_bot_settings(new_settings: BotSettings):
    try:
        existing = settings.find_one({})
        if existing:
            settings.update_one(
                {"id": existing["id"]},
                {"$set": new_settings.dict(exclude={"id", "created_at"})}
            )
        else:
            new_settings.id = str(uuid.uuid4())
            new_settings.created_at = datetime.utcnow()
            settings.insert_one(new_settings.dict())
        
        return {"message": "Settings updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Activity Logs
@app.get("/api/logs")
async def get_activity_logs(limit: int = 50):
    try:
        logs = list(activity_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit))
        return {"logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Bot Control
@app.post("/api/bot/start")
async def start_bot():
    global bot_running
    try:
        if bot_running:
            return {"message": "Bot is already running"}
        
        # Start the scheduler
        if not scheduler.running:
            scheduler.start()
            
        # Add monitoring job
        scheduler.add_job(
            monitor_and_comment,
            IntervalTrigger(minutes=5),  # Check every 5 minutes
            id="tweet_monitor",
            replace_existing=True
        )
        
        bot_running = True
        
        # Log the start
        log_entry = ActivityLog(
            id=str(uuid.uuid4()),
            target_username="SYSTEM",
            tweet_id="N/A",
            tweet_url="N/A",
            comment_text="Bot started",
            status="success",
            timestamp=datetime.utcnow()
        )
        activity_logs.insert_one(log_entry.dict())
        
        return {"message": "Bot started successfully"}
    except Exception as e:
        logger.error(f"Failed to start bot: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/bot/stop")
async def stop_bot():
    global bot_running
    try:
        if not bot_running:
            return {"message": "Bot is not running"}
        
        # Remove the job
        if scheduler.get_job("tweet_monitor"):
            scheduler.remove_job("tweet_monitor")
        
        bot_running = False
        
        # Log the stop
        log_entry = ActivityLog(
            id=str(uuid.uuid4()),
            target_username="SYSTEM",
            tweet_id="N/A",
            tweet_url="N/A",
            comment_text="Bot stopped",
            status="success",
            timestamp=datetime.utcnow()
        )
        activity_logs.insert_one(log_entry.dict())
        
        return {"message": "Bot stopped successfully"}
    except Exception as e:
        logger.error(f"Failed to stop bot: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Core Bot Functions
async def monitor_and_comment():
    """Monitor target accounts and post comments on new tweets"""
    try:
        logger.info("Starting tweet monitoring cycle...")
        
        # Get bot settings
        bot_settings = settings.find_one({})
        if not bot_settings or not bot_settings.get("is_active"):
            logger.info("Bot is disabled in settings")
            return
        
        # Get active target accounts
        active_accounts = list(target_accounts.find({"is_active": True}))
        if not active_accounts:
            logger.info("No active target accounts found")
            return
        
        # Get available comments
        available_comments = list(comments.find({"is_active": True}))
        if not available_comments:
            logger.info("No active comments found")
            return
        
        # Process each target account
        for account in active_accounts:
            try:
                await process_account_tweets(account, available_comments, bot_settings)
            except Exception as e:
                logger.error(f"Error processing account @{account['username']}: {e}")
                
    except Exception as e:
        logger.error(f"Error in monitor_and_comment: {e}")

async def process_account_tweets(account, available_comments, bot_settings):
    """Process tweets from a specific account"""
    try:
        username = account["username"]
        logger.info(f"Processing tweets from @{username}")
        
        # Get user ID
        user = twitter_client.get_user(username=username)
        user_id = user.data.id
        
        # Get recent tweets
        tweets = twitter_client.get_users_tweets(
            id=user_id,
            max_results=10,
            tweet_fields=['created_at', 'public_metrics'],
            exclude=['retweets', 'replies']
        )
        
        if not tweets.data:
            logger.info(f"No recent tweets found for @{username}")
            return
        
        # Process each tweet
        for tweet in tweets.data:
            # Skip if we've already processed this tweet
            if account.get("last_tweet_id") and tweet.id <= account["last_tweet_id"]:
                continue
            
            # Check if tweet is recent (within last hour for initial engagement)
            tweet_time = tweet.created_at.replace(tzinfo=None)
            if datetime.utcnow() - tweet_time > timedelta(hours=1):
                continue
            
            # Random chance to comment (to avoid spamming every tweet)
            if random.random() > 0.7:  # 70% chance to comment
                continue
            
            # Select a random comment
            comment = random.choice(available_comments)
            comment_text = comment["text"]
            
            # Add some randomization to the comment
            comment_text = randomize_comment(comment_text)
            
            # Post the comment
            success = await post_comment(tweet.id, comment_text, username, tweet)
            
            if success:
                # Update usage count
                comments.update_one(
                    {"id": comment["id"]},
                    {"$inc": {"usage_count": 1}}
                )
                
                # Add random delay before next comment
                delay = random.randint(
                    bot_settings.get("min_delay_minutes", 30),
                    bot_settings.get("max_delay_minutes", 180)
                )
                logger.info(f"Waiting {delay} minutes before next action")
                await asyncio.sleep(delay * 60)
        
        # Update last processed tweet ID
        if tweets.data:
            target_accounts.update_one(
                {"id": account["id"]},
                {"$set": {"last_tweet_id": tweets.data[0].id}}
            )
            
    except Exception as e:
        logger.error(f"Error processing account @{account['username']}: {e}")

async def post_comment(tweet_id, comment_text, target_username, tweet):
    """Post a comment to a tweet"""
    try:
        logger.info(f"Posting comment to tweet {tweet_id}: {comment_text}")
        
        # Post the reply using Twitter API v1.1
        response = twitter_api_v1.update_status(
            status=comment_text,
            in_reply_to_status_id=tweet_id,
            auto_populate_reply_metadata=True
        )
        
        tweet_url = f"https://twitter.com/{target_username}/status/{tweet_id}"
        
        # Log successful comment
        log_entry = ActivityLog(
            id=str(uuid.uuid4()),
            target_username=target_username,
            tweet_id=str(tweet_id),
            tweet_url=tweet_url,
            comment_text=comment_text,
            status="success",
            timestamp=datetime.utcnow()
        )
        activity_logs.insert_one(log_entry.dict())
        
        logger.info(f"Successfully posted comment to @{target_username}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to post comment: {e}")
        
        # Log failed comment
        log_entry = ActivityLog(
            id=str(uuid.uuid4()),
            target_username=target_username,
            tweet_id=str(tweet_id),
            tweet_url=f"https://twitter.com/{target_username}/status/{tweet_id}",
            comment_text=comment_text,
            status="failed",
            error_message=str(e),
            timestamp=datetime.utcnow()
        )
        activity_logs.insert_one(log_entry.dict())
        
        return False

def randomize_comment(comment_text):
    """Add slight randomization to comments to appear more human"""
    # Add random emojis occasionally
    crypto_emojis = ["🚀", "💎", "🐸", "🌙", "💰", "📈", "🔥", "⚡"]
    
    if random.random() < 0.3:  # 30% chance to add emoji
        emoji = random.choice(crypto_emojis)
        comment_text += f" {emoji}"
    
    return comment_text

# Initialize default data on startup
@app.on_event("startup")
async def startup_event():
    try:
        # Add some default comments if none exist
        if comments.count_documents({}) == 0:
            default_comments = [
                Comment(
                    id=str(uuid.uuid4()),
                    text="This tweet aged like my $PEPUMP bag 💀",
                    category="ironic",
                    created_at=datetime.utcnow()
                ),
                Comment(
                    id=str(uuid.uuid4()),
                    text="RT if you're holding $PEPUMP to Valhalla 🐸🚀",
                    category="bullish",
                    created_at=datetime.utcnow()
                ),
                Comment(
                    id=str(uuid.uuid4()),
                    text="When $DOGE goes sideways, my frog goes vertical 🐸📈 #PEPUMP",
                    category="provocative",
                    created_at=datetime.utcnow()
                ),
                Comment(
                    id=str(uuid.uuid4()),
                    text="Still early for $PEPUMP gang 💎",
                    category="bullish",
                    created_at=datetime.utcnow()
                ),
                Comment(
                    id=str(uuid.uuid4()),
                    text="This is why we can't have nice things in crypto 😂",
                    category="ironic",
                    created_at=datetime.utcnow()
                )
            ]
            
            for comment in default_comments:
                comments.insert_one(comment.dict())
            
            logger.info("Default comments added")
        
        # Add default target accounts
        if target_accounts.count_documents({}) == 0:
            default_targets = [
                TargetAccount(
                    id=str(uuid.uuid4()),
                    username="elonmusk",
                    display_name="Elon Musk",
                    is_active=False,  # Start disabled for safety
                    created_at=datetime.utcnow()
                ),
                TargetAccount(
                    id=str(uuid.uuid4()),
                    username="CryptoBitlord",
                    display_name="Crypto Bitlord",
                    is_active=False,
                    created_at=datetime.utcnow()
                )
            ]
            
            for target in default_targets:
                target_accounts.insert_one(target.dict())
                
            logger.info("Default target accounts added")
            
    except Exception as e:
        logger.error(f"Startup initialization error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)