import client from './client';

export const getModelList = (title) => client.get(`/fedops/api/model/${title}`);
export const getPublicModelList = ({ handle, slug }) =>
    client.get(`/fedops/api/model/public/${encodeURIComponent(handle)}/${encodeURIComponent(slug)}`);
export const getTaskHubArtifacts = (title) =>
    client.get(`/fedops/api/model/${encodeURIComponent(title)}/hub`);
export const downloadPublicModel = ({ handle, slug, versionId }) =>
    client.get(
        `/fedops/api/model/public/${encodeURIComponent(handle)}/${encodeURIComponent(slug)}`
        + `/versions/${encodeURIComponent(versionId)}/download`,
    );
export const downloadTaskModel = ({ title, versionId }) =>
    client.get(
        `/fedops/api/model/${encodeURIComponent(title)}`
        + `/versions/${encodeURIComponent(versionId)}/download`,
    );
export const downloadPublicFile = ({ handle, slug, fileId }) =>
    client.get(
        `/fedops/api/model/public/${encodeURIComponent(handle)}/${encodeURIComponent(slug)}`
        + `/files/${encodeURIComponent(fileId)}/download`,
    );
export const previewPublicFile = ({ handle, slug, fileId }) =>
    client.get(
        `/fedops/api/model/public/${encodeURIComponent(handle)}/${encodeURIComponent(slug)}`
        + `/files/${encodeURIComponent(fileId)}/preview`,
    );
export const downloadTaskFile = ({ title, fileId }) =>
    client.get(
        `/fedops/api/model/${encodeURIComponent(title)}`
        + `/files/${encodeURIComponent(fileId)}/download`,
    );
export const previewTaskFile = ({ title, fileId }) =>
    client.get(
        `/fedops/api/model/${encodeURIComponent(title)}`
        + `/files/${encodeURIComponent(fileId)}/preview`,
    );
export const getXAIModel = (title, modelVersion) => 
    client.get(`/fedops/api/model/xai/${title}`, {
        modelVersion,
    });
