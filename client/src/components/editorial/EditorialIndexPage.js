import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import Header from '../common/Header';
import ContentWrapper from '../common/ContentWrapper';
import PageHeader from '../common/PageHeader';

const stripMarkdown = (value = '') => value
  .replace(/!\[[^\]]*]\([^)]*\)/g, '')
  .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
  .replace(/[`*_>#~-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const dateFromObjectId = (value) => {
  if (!/^[a-f\d]{24}$/i.test(value || '')) return null;
  const date = new Date(parseInt(value.slice(0, 8), 16) * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
};

const postDate = (post, kind) => {
  if (kind === 'news' && post.date) {
    const date = new Date(post.date);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return dateFromObjectId(post._id);
};

const formatDate = (value) => (
  value
    ? value.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    : 'Recently published'
);

const editorialConfig = {
  news: {
    title: 'FedOps News',
    eyebrow: 'Updates',
    description: 'Research releases, publications, videos, and platform updates from FedOps.',
    empty: 'No news has been published yet.',
    Icon: CampaignOutlinedIcon,
  },
  blog: {
    title: 'FedOps Blog',
    eyebrow: 'Stories & guides',
    description: 'Technical notes, federated-learning practices, and stories from the FedOps team.',
    empty: 'No blog posts have been published yet.',
    Icon: ArticleOutlinedIcon,
  },
};

const EditorialIndexPage = ({ kind }) => {
  const config = editorialConfig[kind];
  const [posts, setPosts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPosts = async () => {
    const response = await axios.get(`/fedops/api/${kind}/list`);
    const sorted = [...response.data].sort((left, right) => (
      (postDate(right, kind)?.getTime() || 0)
      - (postDate(left, kind)?.getTime() || 0)
    ));
    setPosts(sorted);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.allSettled([
      axios.get(`/fedops/api/${kind}/list`),
      axios.get('/fedops/api/auth/check'),
    ]).then(([postsResult, userResult]) => {
      if (!active) return;
      if (postsResult.status === 'fulfilled') {
        const sorted = [...postsResult.value.data].sort((left, right) => (
          (postDate(right, kind)?.getTime() || 0)
          - (postDate(left, kind)?.getTime() || 0)
        ));
        setPosts(sorted);
      } else {
        setError(
          postsResult.reason.response?.data?.message
          || `Failed to load ${kind} posts.`,
        );
      }
      setCurrentUser(
        userResult.status === 'fulfilled' ? userResult.value.data : null,
      );
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [kind]);

  const handleDelete = async (post) => {
    if (!window.confirm(`Delete "${post.title}"?`)) return;
    try {
      await axios.delete(`/fedops/api/${kind}/posts/${post._id}`);
      await loadPosts();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || `Failed to delete this ${kind} post.`,
      );
    }
  };

  const isAdmin = Boolean(currentUser?.isAdmin);
  const detailPath = (post) => `/fedops/${kind}/${encodeURIComponent(post._id)}`;

  return (
    <>
      <Header />
      <ContentWrapper>
        <PageHeader
          eyebrow={config.eyebrow}
          title={config.title}
          description={config.description}
          meta={!loading && !error ? `${posts.length} published posts` : undefined}
          action={isAdmin ? (
            <Button
              component={Link}
              to={`/fedops/${kind}write`}
              variant="contained"
              startIcon={<AddRoundedIcon />}
            >
              Write {kind === 'news' ? 'news' : 'post'}
            </Button>
          ) : undefined}
        />

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '38vh' }}>
            <CircularProgress size={28} />
          </Box>
        ) : posts.length ? (
          <Grid container spacing={2.5}>
            {posts.map((post) => {
              const Icon = config.Icon;
              const published = postDate(post, kind);
              const excerpt = stripMarkdown(post.content);
              return (
                <Grid item xs={12} md={6} lg={4} key={post._id}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      backgroundColor: 'background.paper',
                      '&:hover': {
                        borderColor: 'primary.main',
                      },
                    }}
                  >
                    {kind === 'blog' && post.image && (
                      <Box
                        component="a"
                        href={detailPath(post)}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          display: 'block',
                          height: 176,
                          overflow: 'hidden',
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <Box
                          component="img"
                          src={post.image}
                          alt=""
                          loading="lazy"
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transition: 'transform 180ms ease',
                            '&:hover': { transform: 'scale(1.015)' },
                          }}
                        />
                      </Box>
                    )}
                    <CardActionArea
                      component="a"
                      href={detailPath(post)}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        flexGrow: 1,
                      }}
                    >
                      <CardContent
                        sx={{
                          p: 3,
                          width: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          flexGrow: 1,
                        }}
                      >
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          spacing={1}
                          sx={{ mb: 2.5 }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                display: 'grid',
                                placeItems: 'center',
                                borderRadius: 1,
                                color: 'primary.dark',
                                backgroundColor: 'primary.light',
                              }}
                            >
                              <Icon sx={{ fontSize: 18 }} />
                            </Box>
                            <Chip
                              size="small"
                              label={kind === 'news' ? post.tag || 'NEWS' : 'BLOG'}
                              variant="outlined"
                              sx={{ borderColor: 'divider', backgroundColor: '#fff' }}
                            />
                          </Stack>
                          <OpenInNewRoundedIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
                        </Stack>
                        <Typography
                          variant="h5"
                          component="h2"
                          sx={{
                            mb: 1.25,
                            display: '-webkit-box',
                            overflow: 'hidden',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: 3,
                          }}
                        >
                          {post.title}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            mb: 3,
                            display: '-webkit-box',
                            overflow: 'hidden',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: 3,
                            flexGrow: 1,
                          }}
                        >
                          {excerpt || 'Open this post to read more.'}
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          spacing={1}
                        >
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {kind === 'news' ? post.author || 'FedOps' : 'FedOps'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {formatDate(published)}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </CardActionArea>
                    {isAdmin && (
                      <CardActions sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Button
                          component={Link}
                          to={`/fedops/${kind}/edit/${encodeURIComponent(post._id)}`}
                          size="small"
                          startIcon={<EditOutlinedIcon />}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          startIcon={<DeleteOutlineRoundedIcon />}
                          onClick={() => handleDelete(post)}
                        >
                          Delete
                        </Button>
                      </CardActions>
                    )}
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        ) : (
          <Alert severity="info">{config.empty}</Alert>
        )}
      </ContentWrapper>
    </>
  );
};

export default EditorialIndexPage;
