import { downloadUrl } from '../lib/runtimeConfig';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  CircularProgress,
} from '@mui/material';
import Header from '../components/common/Header';
import ContentWrapper from '../components/common/ContentWrapper';
import TaskHubContent from '../components/task/TaskHubContent';
import * as tasksAPI from '../lib/api/tasks';
import * as modelAPI from '../lib/api/model';

const SharedTaskDetailPage = () => {
  const { title } = useParams();
  const [task, setTask] = useState(null);
  const [models, setModels] = useState([]);
  const [files, setFiles] = useState([]);
  const [usage, setUsage] = useState(null);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modelError, setModelError] = useState('');
  const [activityError, setActivityError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setModelError('');
    setActivityError('');

    Promise.allSettled([
      tasksAPI.readTask(title),
      modelAPI.getTaskHubArtifacts(title),
      tasksAPI.readTaskActivity(title),
    ]).then(([taskResult, modelResult, activityResult]) => {
      if (!active) return;
      if (taskResult.status === 'fulfilled') {
        setTask(taskResult.value.data);
      } else {
        setError(
          taskResult.reason.response?.data?.message
          || 'This joined Federated Task is no longer available.',
        );
      }
      if (modelResult.status === 'fulfilled') {
        setModels(modelResult.value.data.models || []);
        setFiles(modelResult.value.data.files || []);
        setUsage(modelResult.value.data.usage || null);
      } else {
        setModelError(
          modelResult.reason.response?.data?.message
          || 'Model artifacts could not be loaded.',
        );
      }
      if (activityResult.status === 'fulfilled') {
        setActivity(activityResult.value.data);
      } else {
        setActivityError(
          activityResult.reason.response?.data?.message
          || 'Training activity could not be loaded.',
        );
      }
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [title]);

  const openDownload = (url) => {
    const anchor = document.createElement('a');
    anchor.href = downloadUrl(url);
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const downloadModel = async (model) => {
    const response = await modelAPI.downloadTaskModel({
      title,
      versionId: model.id,
    });
    openDownload(response.data.url);
    setUsage((current) => current && ({
      ...current,
      modelDownloads: (current.modelDownloads || 0) + 1,
    }));
  };

  const downloadFile = async (file) => {
    const response = await modelAPI.downloadTaskFile({
      title,
      fileId: file.id,
    });
    openDownload(response.data.url);
  };

  const previewFile = async (file) => {
    const response = await modelAPI.previewTaskFile({
      title,
      fileId: file.id,
    });
    return response.data;
  };

  const updateTaskCard = async (markdown) => {
    const response = await tasksAPI.updateTaskCard(title, markdown);
    setTask((current) => ({
      ...current,
      cardMarkdown: response.data.cardMarkdown,
      updatedAt: response.data.updatedAt,
    }));
  };

  if (loading) {
    return (
      <>
        <Header />
        <ContentWrapper maxWidth="xl">
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
            <CircularProgress />
          </Box>
        </ContentWrapper>
      </>
    );
  }

  return (
    <>
      <Header />
      <ContentWrapper maxWidth="xl">
        {error || !task ? (
          <Alert severity="error">{error || 'Joined Federated Task not found.'}</Alert>
        ) : (
          <TaskHubContent
            task={task}
            models={models}
            files={files}
            usage={usage}
            activity={activity}
            activityError={activityError}
            modelError={modelError}
            isAuthenticated
            onDownloadModel={downloadModel}
            onDownloadFile={downloadFile}
            onPreviewFile={previewFile}
            onUpdateTaskCard={
              task.permissions?.canManage ? updateTaskCard : undefined
            }
          />
        )}
      </ContentWrapper>
    </>
  );
};

export default SharedTaskDetailPage;
