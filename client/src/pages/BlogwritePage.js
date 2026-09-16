import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/common/Header';
import ContentWrapper from '../components/common/ContentWrapper';
import MDEditor from '@uiw/react-md-editor';
import axios from "axios";

const BlogwritePage = ({ markdown }) => {
  const [newPost, setNewPost] = useState("**Hello world!!!**");
  const [title, setTitle] = useState("");
  const [image, setImage] = useState("");
  const [author, setAuthor] = useState("");
  const [date, setDate] = useState("");
  const [tag, setTag] = useState("paper"); // Default tag
  const [link, setLink] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  // Determine post type based on current pathname
  const postType = location.pathname.includes("/fedops/news") ? "news" : "blog";

  // Handle new post submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    const postData = {
      title,
      content: newPost,
    };

    if (postType === "news") {
      postData.author = author;
      postData.date = date;
      postData.tag = tag;
      postData.link = link;
    }
    if (postType === "blog") {
      postData.image = image;
    }

    await axios.post(`/fedops/api/${postType}/posts`, postData);

    setNewPost("");
    setTitle("");
    setImage("");
    setAuthor("");
    setDate("");
    setTag("paper"); // Reset tag to default
    setLink("");
    navigate(`/fedops/${postType}`);
  };

  return (
    <div>
      <Header />
      <ContentWrapper>
        <div className="container">
          <h1>Write {postType === "news" ? "News" : "Blog"} Post</h1>
          <form onSubmit={handleSubmit}>
            <div className="container">
              <div style={{ marginBottom: "20px" }}>
                <label htmlFor="title">Title:</label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter post title"
                  style={{ width: "100%", padding: "10px", margin: "10px 0" }}
                />
              </div>
              {postType === "blog" && (
                <div style={{ marginBottom: "20px" }}>
                  <label htmlFor="image">Image URL:</label>
                  <input
                    id="image"
                    type="text"
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    placeholder="Enter image URL"
                    style={{ width: "100%", padding: "10px", margin: "10px 0" }}
                  />
                </div>
              )}
              {postType === "news" && (
                <>
                  <div style={{ marginBottom: "20px" }}>
                    <label htmlFor="author">Author:</label>
                    <input
                      id="author"
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="Enter author name"
                      style={{ width: "100%", padding: "10px", margin: "10px 0" }}
                    />
                  </div>
                  <div style={{ marginBottom: "20px" }}>
                    <label htmlFor="date">Date:</label>
                    <input
                      id="date"
                      type="text"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      placeholder="Enter publication date"
                      style={{ width: "100%", padding: "10px", margin: "10px 0" }}
                    />
                  </div>
                  <div style={{ marginBottom: "20px" }}>
                    <label htmlFor="tag">Tag:</label>
                    <select
                      id="tag"
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                      style={{ width: "100%", padding: "10px", margin: "10px 0" }}
                    >
                      <option value="PAPER">Paper</option>
                      <option value="VIDEO">Video</option>
                      <option value="RELEASE">Release</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: "20px" }}>
                    <label htmlFor="link">Link:</label>
                    <input
                      id="link"
                      type="text"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="Enter publication date"
                      style={{ width: "100%", padding: "10px", margin: "10px 0" }}
                    />
                  </div>
                </>
              )}
              <MDEditor
                value={newPost}
                onChange={setNewPost}
              />
              <MDEditor.Markdown source={newPost} style={{ whiteSpace: 'pre-wrap' }} />
            </div>
            <button type="submit">Submit</button>
          </form>
        </div>
      </ContentWrapper>
    </div>
  );
};

export default BlogwritePage;
