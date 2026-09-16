import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  CircularProgress,
} from '@mui/material';
import Header from '../components/common/Header';
import ContentWrapper from '../components/common/ContentWrapper';
import LoginRequiredNotice from '../components/auth/LoginRequiredNotice';
import TaskHubContent from '../components/task/TaskHubContent';
import useAuth from '../components/hooks/useAuth';
import * as tasksAPI from '../lib/api/tasks';
import * as modelAPI from '../lib/api/model';

const PublicTaskDetailPage = () => {
  const { handle, slug } = useParams();
  const user = useAuth();
  const [task, setTask] = useState(null);
  const [models, setModels] = useState([]);
  const [files, setFiles] = useState([]);
  const [usage, setUsage] = useState(null);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modelError, setModelError] = useState('');
  const [activityError, setActivityError] = useState('');
  const [joinStatus, setJoinStatus] = useState('');
  const [participationBusy, setParticipationBusy] = useState(false);

  const loadArtifacts = useCallback(async () => {
    try {
      const response = await modelAPI.getPublicModelList({ handle, slug });
      setModels(response.data.models || []);
      setFiles(response.data.files || []);
      setUsage(response.data.usage || null);
      setModelError('');
    } catch (requestError) {
      setModels([]);
      setFiles([]);
      setModelError(
        requestError.response?.data?.message || 'Model artifacts could not be loaded.',
      );
    }
  }, [handle, slug]);

  const loadActivity = useCallback(async () => {
    try {
      const response = await tasksAPI.readPublicTaskActivity({ handle, slug });
      setActivity(response.data);
      setActivityError('');
    } catch (requestError) {
      setActivityError(
        requestError.response?.data?.message || 'Training activity could not be loaded.',
      );
    }
  }, [handle, slug]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    setModelError('');
    setActivityError('');

    Promise.allSettled([
      tasksAPI.readPublicTask({ handle, slug }),
      modelAPI.getPublicModelList({ handle, slug }),
      tasksAPI.readPublicTaskActivity({ handle, slug }),
    ]).then(([taskResult, modelResult, activityResult]) => {
      if (!active) return;
      if (taskResult.status === 'fulfilled') {
        setTask(taskResult.value.data);
      } else {
        setError(
          taskResult.reason.response?.data?.message
          || 'Failed to load the Federated Task.',
        );
      }
      if (modelResult.status === 'fulfilled') {
        setModels(modelResult.value.data.models || []);
        setFiles(modelResult.value.data.files || []);
        setUsage(modelResult.value.data.usage || null);
      } else {
        setModelError(
          modelResult.reason.response?.data?.message || 'Model artifacts could not be loaded.',
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
  }, [handle, slug, user]);

  useEffect(() => {
    if (!user || !task) return undefined;
    let refreshing = false;
    const refreshVisibleActivity = async () => {
      if (document.visibilityState !== 'visible' || refreshing) return;
      refreshing = true;
      try {
        await loadActivity();
      } finally {
        refreshing = false;
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshVisibleActivity();
    };
    const interval = window.setInterval(refreshVisibleActivity, 15_000);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadActivity, task, user]);

  const requestParticipation = async () => {
    setParticipationBusy(true);
    setJoinStatus('');
    try {
      const response = await tasksAPI.requestParticipation(task.taskId);
      setJoinStatus(
        response.data.status === 'approved'
          ? 'Participation approved automatically.'
          : 'Participation request sent to the Federated Task owner.',
      );
      const [taskResponse] = await Promise.all([
        tasksAPI.readPublicTask({ handle, slug }),
        loadActivity(),
      ]);
      setTask(taskResponse.data);
      if (taskResponse.data.permissions?.canDownloadModels) {
        await loadArtifacts();
      }
    } catch (requestError) {
      setJoinStatus(
        requestError.response?.data?.message || 'Failed to request participation.',
      );
    } finally {
      setParticipationBusy(false);
    }
  };

  const leaveParticipation = async () => {
    const pending = task.permissions?.participationStatus === 'requested';
    const confirmed = window.confirm(
      pending
        ? 'Withdraw this Federated Learning participation request?'
        : 'Leave this Federated Task? Web access is revoked immediately, but files already downloaded to your device cannot be removed remotely.',
    );
    if (!confirmed) return;
    setParticipationBusy(true);
    setJoinStatus('');
    try {
      await tasksAPI.leaveParticipation(task.taskId);
      setJoinStatus(
        pending
          ? 'Participation request withdrawn. You may request to join again later.'
          : 'You left this Federated Task. You may request to join again later.',
      );
      const [taskResponse] = await Promise.all([
        tasksAPI.readPublicTask({ handle, slug }),
        loadActivity(),
      ]);
      setTask(taskResponse.data);
      if (!taskResponse.data.permissions?.canDownloadModels) {
        setModels([]);
        setFiles([]);
        setUsage(null);
      }
    } catch (requestError) {
      setJoinStatus(
        requestError.response?.data?.message || 'Failed to leave this Federated Task.',
      );
    } finally {
      setParticipationBusy(false);
    }
  };

  const openDownload = (url) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const downloadModel = async (model) => {
    const response = await modelAPI.downloadPublicModel({
      handle,
      slug,
      versionId: model.id,
    });
    openDownload(response.data.url);
    setUsage((current) => current && ({
      ...current,
      modelDownloads: (current.modelDownloads || 0) + 1,
    }));
  };

  const downloadFile = async (file) => {
    const response = await modelAPI.downloadPublicFile({
      handle,
      slug,
      fileId: file.id,
    });
    openDownload(response.data.url);
  };

  const previewFile = async (file) => {
    const response = await modelAPI.previewPublicFile({
      handle,
      slug,
      fileId: file.id,
    });
    return response.data;
  };

  const updateTaskCard = async (markdown) => {
    const response = await tasksAPI.updateTaskCard(task.title, markdown);
    setTask((current) => ({
      ...current,
      cardMarkdown: response.data.cardMarkdown,
      updatedAt: response.data.updatedAt,
    }));
  };

  if (!user) {
    return (
      <>
        <Header />
        <ContentWrapper maxWidth="xl">
          <LoginRequiredNotice
            title="Sign in to view this Federated Task"
            description={
              'Registry details, training activity, files, and model resources '
              + 'are available after sign-in.'
            }
          />
        </ContentWrapper>
      </>
    );
  }

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
          <Alert severity="error">{error || 'Federated Task not found in the Registry.'}</Alert>
        ) : (
          <TaskHubContent
            task={task}
            models={models}
            files={files}
            usage={usage}
            activity={activity}
            activityError={activityError}
            modelError={modelError}
            isAuthenticated={Boolean(user)}
            onRequestParticipation={requestParticipation}
            onLeaveParticipation={leaveParticipation}
            participationBusy={participationBusy}
            onDownloadModel={downloadModel}
            onDownloadFile={downloadFile}
            onPreviewFile={previewFile}
            onUpdateTaskCard={
              task.permissions?.canManage ? updateTaskCard : undefined
            }
            joinStatus={joinStatus}
          />
        )}
      </ContentWrapper>
    </>
  );
};

export default PublicTaskDetailPage;
