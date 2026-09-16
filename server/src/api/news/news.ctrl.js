import mongoose from 'mongoose';

// Define Schema
const NewsSchema = new mongoose.Schema({
  title: { type: String, required: true }, // 제목 추가
  author: { type: String, required: true }, // 작성자 추가
  date: { type: String, required: true }, // 작성일 추가
  content: { type: String, required: true },
  tag: { type: String, required: true, default: 'PAPER' }, // 태그 추가, 기본값 설정
  link: { type: String, default: '' }, // 링크 추가, 기본값 설정
});

const News = mongoose.model("News", NewsSchema);

// Add a new post
export const post = async (ctx) => {
  const { title, author, content, date, tag, link } = ctx.request.body;

  const newPost = new News({
    title,
    author,
    date,
    content,
    tag,
    link,
  });

  try {
    await newPost.save();
    ctx.status = 201; // Created
    ctx.body = { success: true, post: newPost };
  } catch (e) {
    ctx.status = 500; // Internal Server Error
    ctx.body = { success: false, message: e.message };
  }
};

// List all posts
export const list = async (ctx) => {
  try {
    let posts = await News.find();

    // 기존 데이터에 tag 필드가 없는 경우 기본값 설정
    posts = posts.map(post => {
      if (!post.tag) {
        post.tag = 'PAPER'; // 기본값 설정
      }
      return post;
    });

    ctx.status = 200; // OK
    ctx.body = posts;
  } catch (e) {
    ctx.status = 500; // Internal Server Error
    ctx.body = { success: false, message: e.message };
  }
};

// Delete a post
export const remove = async (ctx) => {
  const { id } = ctx.params;

  try {
    const deletedPost = await News.findByIdAndDelete(id);

    if (!deletedPost) {
      ctx.status = 404; // Not Found
      ctx.body = { success: false, message: "Post not found" };
      return;
    }

    ctx.status = 204; // No Content
  } catch (e) {
    ctx.status = 500; // Internal Server Error
    ctx.body = { success: false, message: e.message };
  }
};

// Update a post
export const update = async (ctx) => {
  const { id } = ctx.params;
  const { title, content, author, date, tag, link } = ctx.request.body;

  try {
    const updatedPost = await News.findByIdAndUpdate(
      id,
      { title, content, author, date, tag, link },
      { new: true }
    );

    if (!updatedPost) {
      ctx.status = 404; // Not Found
      ctx.body = { success: false, message: "Post not found" };
      return;
    }

    ctx.status = 200; // OK
    ctx.body = { success: true, post: updatedPost };
  } catch (e) {
    ctx.status = 500; // Internal Server Error
    ctx.body = { success: false, message: e.message };
  }
};

// Read a post
export const read = async (ctx) => {
  const { id } = ctx.params;

  try {
    const post = await News.findById(id);

    if (!post) {
      ctx.status = 404; // Not Found
      ctx.body = { success: false, message: "Post not found" };
      return;
    }

    ctx.status = 200; // OK
    ctx.body = post;
  } catch (e) {
    ctx.status = 500; // Internal Server Error
    ctx.body = { success: false, message: e.message };
  }
};