import json
from datetime import date
from unittest.mock import patch, MagicMock

# IMPORTANT:
# Update this import path ONLY if your file location is different
import backend.services.newsapi_scrapper.news_api_fetcher as news_api_fetcher

# --------------------------------------------------
# Test: get_previous_day
# --------------------------------------------------


def test_get_previous_day_with_given_date():
    test_date = date(2026, 1, 10)
    result = news_api_fetcher.get_previous_day(test_date)
    assert result == date(2026, 1, 8)


def test_get_previous_day_without_argument():
    today = date.today()
    result = news_api_fetcher.get_previous_day()
    assert result == today - news_api_fetcher.timedelta(days=2)


# --------------------------------------------------
# Test: get_full_article_content
# --------------------------------------------------


def test_get_full_article_content(monkeypatch):
    def fake_get_full_article_content(url):
        return "This is the full article content."

    monkeypatch.setattr(
        news_api_fetcher, "get_full_article_content", fake_get_full_article_content
    )

    content = news_api_fetcher.get_full_article_content("https://example.com/article")

    assert content == "This is the full article content."


# --------------------------------------------------
# Test: get_newsorg_data
# --------------------------------------------------
@patch("services.newsapi_scrapper.news_api_fetcher.requests.get")
def test_get_newsorg_data(mock_get):
    fake_response_data = {
        "articles": [{"title": "AI News", "url": "https://example.com"}]
    }

    mock_response = MagicMock()
    mock_response.__iter__.return_value = [
        json.dumps(fake_response_data).encode("utf-8")
    ]

    mock_get.return_value = mock_response

    articles = news_api_fetcher.get_newsorg_data("AI")

    assert isinstance(articles, list)
    assert articles[0]["title"] == "AI News"


# --------------------------------------------------
# Test: get_newsapi_data
# --------------------------------------------------


def test_get_newsapi_data(monkeypatch):
    import services.newsapi_scrapper.news_api_fetcher as naf

    mock_client = MagicMock()
    mock_client.get_everything.return_value = {
        "articles": [
            {
                "url": "https://example.com",
                "title": "AI Breakthrough",
                "publishedAt": "2026-01-10T10:00:00Z",
                "content": "Short content",
            }
        ]
    }

    monkeypatch.setattr(naf, "get_newsapi_client", lambda: mock_client)
    monkeypatch.setattr(
        naf, "get_full_article_content", lambda url: "Full AI article content"
    )

    result = naf.get_newsapi_data()

    assert len(result) == 1
    assert result[0]["title"] == "AI Breakthrough"
    assert result[0]["description"] == "Full AI article content"
