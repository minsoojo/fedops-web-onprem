import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Header from '../components/common/Header';
import ContentWrapper from '../components/common/ContentWrapper';
import MDEditor from '@uiw/react-md-editor';
import axios from "axios";

const BlogEditPage = () => {
  const [post, setPost] = useState(null);
  const [title, setTitle] = useState("");
  const [newPost, setNewPost] = useState("");
  const [image, setImage] = useState("");
  const [author, setAuthor] = useState("");
  const [date, setDate] = useState("");
  const [tag, setTag] = useState("paper"); // Default tag
  const [link, setLink] = useState("");
  const { id } = useParams(); // 글 ID
  const navigate = useNavigate();
  const location = useLocation();

  // Determine post type based on current pathname
  const postType = location.pathname.includes("/fedops/news") ? "news" : "blog";

  // Fetch existing post data
  useEffect(() => {
    const fetchPost = async () => {
      const response = await axios.get(`/fedops/api/${postType}/posts/${id}`);
      setPost(response.data);
      setTitle(response.data.title);
      setNewPost(response.data.content);
      if (postType === "news") {
        setAuthor(response.data.author);
        setDate(response.data.date);
        setTag(response.data.tag);
        setLink(response.data.link);
      }
      if (postType === "blog") {
        setImage(response.data.image);
      }
    };
    fetchPost();
  }, [id, postType]);

  // Handle update submission
  const handleUpdate = async (e) => {
    e.preventDefault();
    const updatedData = {
      title,
      content: newPost,
    };
    if (postType === "news") {
      updatedData.author = author;
      updatedData.date = date;
      updatedData.tag = tag;
      updatedData.link = link;
    }
    if (postType === "blog") {
      updatedData.image = image;
    }
    await axios.put(`/fedops/api/${postType}/posts/${id}`, updatedData);
    navigate(`/fedops/${postType}`);
  };

  if (!post) return <div>Loading...</div>; // Loading state

  return (
    <div>
      <Header />
      <ContentWrapper>
        <div className="container">
          <h1>Edit {postType === "news" ? "News" : "Blog"} Post</h1>
          <form onSubmit={handleUpdate}>
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
                      placeholder="Enter publication link"
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
            <button type="submit">Update</button>
          </form>
        </div>
      </ContentWrapper>
    </div>
  );
};

export default BlogEditPage;
