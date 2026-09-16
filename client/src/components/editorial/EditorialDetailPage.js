import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import Header from '../common/Header';
import ContentWrapper from '../common/ContentWrapper';

const dateFromObjectId = (value) => {
  if (!/^[a-f\d]{24}$/i.test(value || '')) return null;
  const date = new Date(parseInt(value.slice(0, 8), 16) * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (post, kind) => {
  const explicit = kind === 'news' && post?.date ? new Date(post.date) : null;
  const value = explicit && !Number.isNaN(explicit.getTime())
    ? explicit
    : dateFromObjectId(post?._id);
  return value
    ? value.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    : null;
};

const youtubeEmbedUrl = (value = '') => {
  try {
    const url = new URL(value);
    if (url.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed/${url.pathname.slice(1)}`;
    }
    if (url.hostname.includes('youtube.com')) {
      const videoId = url.searchParams.get('v');
      return videoId ? `https://www.youtube.com/embed/${videoId}` : value;
    }
    return null;
  } catch {
    return null;
  }
};

const markdownComponents = {
  img({ node, ...props }) {
    const { alt = '', title } = props;
    const match = String(alt).match(/\|(\d+)x(\d+)/);
    const width = match?.[1] ? Number(match[1]) : undefined;
    const height = match?.[2] ? Number(match[2]) : undefined;
    const cleanAlt = String(alt).replace(/\|.*$/, '').trim();
    return (
      <figure>
        <img
          {...props}
          alt={cleanAlt}
          width={width}
          height={height}
          loading="lazy"
        />
        {title && <figcaption>{title}</figcaption>}
      </figure>
    );
  },
};

const EditorialDetailPage = ({ kind }) => {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    axios.get(`/fedops/api/${kind}/posts/${encodeURIComponent(id)}`)
      .then((response) => {
        if (!active) return;
        setPost(response.data);
        document.title = `${response.data.title} · FedOps`;
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          requestError.response?.data?.message
          || `This ${kind} post could not be loaded.`,
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      document.title = 'FedOps';
    };
  }, [id, kind]);

  const embedUrl = kind === 'news' && post?.tag === 'VIDEO'
    ? youtubeEmbedUrl(post.link)
    : null;

  return (
    <>
      <Header />
      <ContentWrapper>
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '48vh' }}>
            <CircularProgress size={28} />
          </Box>
        ) : error || !post ? (
          <Stack spacing={3}>
            <Alert severity="error">{error || 'Post not found.'}</Alert>
            <Button
              component={Link}
              to={`/fedops/${kind}`}
              startIcon={<ArrowBackRoundedIcon />}
              sx={{ alignSelf: 'flex-start' }}
            >
              Back to {kind}
            </Button>
          </Stack>
        ) : (
          <Box sx={{ maxWidth: 900, mx: 'auto' }}>
            <Button
              component={Link}
              to={`/fedops/${kind}`}
              startIcon={<ArrowBackRoundedIcon />}
              sx={{ mb: 4 }}
            >
              All {kind}
            </Button>
            <Box component="header" sx={{ mb: 4 }}>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Chip
                  size="small"
                  label={kind === 'news' ? post.tag || 'NEWS' : 'BLOG'}
                  sx={{
                    color: 'primary.dark',
                    backgroundColor: 'primary.light',
                  }}
                />
              </Stack>
              <Typography variant="h2" component="h1">
                {post.title}
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={{ xs: 0.5, sm: 2 }}
                sx={{ mt: 2 }}
              >
                <Typography variant="body2" color="text.secondary">
                  {kind === 'news' ? post.author || 'FedOps' : 'FedOps'}
                </Typography>
                {formatDate(post, kind) && (
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(post, kind)}
                  </Typography>
                )}
              </Stack>
            </Box>

            <Paper
              component="article"
              variant="outlined"
              sx={{
                p: { xs: 3, md: 5 },
                borderColor: 'divider',
                borderRadius: 1.25,
              }}
            >
              {kind === 'blog' && post.image && (
                <Box
                  component="img"
                  src={post.image}
                  alt=""
                  sx={{
                    display: 'block',
                    width: '100%',
                    maxHeight: 460,
                    objectFit: 'cover',
                    borderRadius: 1,
                    mb: 4,
                  }}
                />
              )}
              {embedUrl && (
                <Box
                  sx={{
                    position: 'relative',
                    width: '100%',
                    pt: '56.25%',
                    mb: 4,
                    overflow: 'hidden',
                    borderRadius: 1,
                    backgroundColor: '#181818',
                  }}
                >
                  <Box
                    component="iframe"
                    title={post.title}
                    src={embedUrl}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      border: 0,
                    }}
                  />
                </Box>
              )}
              <Box className="fedops-markdown">
                <ReactMarkdown
                  components={markdownComponents}
                  remarkPlugins={[remarkGfm]}
                >
                  {post.content || ''}
                </ReactMarkdown>
              </Box>
              {kind === 'news' && post.link && post.tag !== 'VIDEO' && (
                <>
                  <Divider sx={{ my: 4 }} />
                  <Button
                    component="a"
                    href={post.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    endIcon={<OpenInNewRoundedIcon />}
                  >
                    View original source
                  </Button>
                </>
              )}
            </Paper>
          </Box>
        )}
      </ContentWrapper>
    </>
  );
};

export default EditorialDetailPage;
