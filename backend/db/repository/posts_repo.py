from db.client import supabase
from typing import Dict, List, Any

# Repository functions for posts and post content
# Add more functions later as needed, following the same pattern

# Can be broken into two functions further if needed - post addition and post content addition
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
        res = supabase.table("posts").insert(post).execute()
        
        if res.error:
            raise Exception(f"Error adding post: {res.error.message}")
    
    except Exception as e:
        raise Exception(f"Exception in add_post: {str(e)}")
    
    try:
        # Try to add post content in post_content db table
        res_content = supabase.table("post_content").insert(post_content).execute()
        
        if res_content.error:
            raise Exception(f"Error adding post content: {res_content.error.message}")
    
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
        post_content = supabase.table("post_content").select("*,post_content(content)").eq("post_id", post_id).execute()
        
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
    try:
        res = supabase.table("user_liked_posts").insert({"userid":user_id, "likedpostid":post_id}).execute()
    
    except Exception as e:
        raise Exception(f"Exception in user_liked_post: {str(e)}")
    