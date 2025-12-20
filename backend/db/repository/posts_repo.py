from db.client import supabase
from typing import Dict, List, Any

# Repository functions for posts and post content
# Add more functions later as needed, following the same pattern

# Shifted to use RPC to handle both post and post content insertion atomically
def add_post(post: Dict[str,Any], post_content: Dict[str,Any]):
    """
    Docstring for add_post
    
    :param post: Description
    :type post: Dict[str, Any]
    :param post_content: Description
    :type post_content: Dict[str, Any]
    """
    try:
        # Try to add post in posts db table
        res = supabase.rpc("create_post_with_content",{"post_json": post, "post_content_json": post_content}).execute()
        
        if res.error:
            raise Exception(f"Error adding post: {res.error.message}")
    
    except Exception as e:
        raise Exception(f"Exception in add_post: {str(e)}")
    
    
def get_post_by_id(post_id:str):
    
    """
    Docstring for get_post_by_id
    
    :param post_id: Description
    :type post_id: str
    """
    try:
        post = supabase.table("posts").select("*").eq("id", post_id).execute()
        
        if post.error:
            raise Exception(f"Error fetching post by id: {post.error.message}")
        
        return post.data
    
    except Exception as e:
        raise Exception(f"Exception in get_post_by_id: {str(e)}")
    
def get_post_content_by_id(post_id:str):
    """
    Docstring for get_post_content_by_id
    
    :param post_id: Description
    :type post_id: str
    """
    try:
        post_content = supabase.table("post_content").select("*").eq("post_id", post_id).execute()
        
        if post_content.error:
            raise Exception(f"Error fetching post content by id: {post_content.error.message}")
        
        return post_content.data
    
    except Exception as e:
        raise Exception(f"Exception in get_post_content_by_id: {str(e)}")
    
def user_liked_post(user_id:str, post_id:str):
    """
    Docstring for user_liked_post
    
    :param user_id: Description
    :type user_id: str
    :param post_id: Description
    :type post_id: str
    """
    
    # Todo : Need to add Primary key constraint on (userid, likedpostid) in supabase table to avoid duplicate likes
    try:
        res = supabase.table("user_liked_posts").insert({
            "userid": user_id, 
            "likedpostid": post_id
        }).execute()
        
        if res.error:
            # Check if it's a duplicate key constraint violation
            if "duplicate" in str(res.error).lower() or "unique constraint" in str(res.error).lower():
                return False  # Already liked
            raise Exception(f"Error recording like: {res.error.message}")
        
        return True
    
    except Exception as e:
        raise Exception(f"Exception in user_liked_post: {str(e)}") from e