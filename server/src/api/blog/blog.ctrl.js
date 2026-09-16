import mongoose from 'mongoose';

// Define Schema
const PostSchema = new mongoose.Schema({
  title: { type: String, required: true }, // 제목 추가
  content: { type: String, required: true },
  image: { type: String, required: false }, // 이미지 URL 추가
});

const Post = mongoose.model("Post", PostSchema);

// Add a new post
export const post = async (ctx) => {
  const { title, content, image } = ctx.request.body;

  const newPost = new Post({
    title,
    content,
    image,
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
    const posts = await Post.find();
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
    const deletedPost = await Post.findByIdAndDelete(id);

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

export const update = async (ctx) => {
  const { id } = ctx.params;
  const { title, content, image } = ctx.request.body;

  try {
    const updatedPost = await Post.findByIdAndUpdate(
      id,
      { title, content, image },
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

export const read = async (ctx) => {
  const { id } = ctx.params;

  try {
    const post = await Post.findById(id);

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
