import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import serverControlAPI from '../../lib/api/serverControlAPI';
import ServerControl from './ServerControl';

jest.mock('../../lib/api/serverControlAPI', () => ({
  __esModule: true,
  default: {
    getServerStatus: jest.fn(),
    getConnectionInfo: jest.fn(),
    checkServerReady: jest.fn(),
    getCampaign: jest.fn(),
    saveCampaign: jest.fn(),
    checkValidation: jest.fn(),
    getValidationData: jest.fn(),
    createScalableServerFromSaved: jest.fn(),
  },
}));

describe('ServerControl runtime overview', () => {
  test.each([true, false])('shows live progress and elapsed time for evaluation enabled=%s until completion', async (enabled) => {
    jest.useFakeTimers();
    let finish;
    serverControlAPI.checkValidation.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const getCampaign = serverControlAPI.getCampaign.getMockImplementation();
    serverControlAPI.getCampaign.mockImplementation(async () => {
      const value = await getCampaign();
      return { ...value, campaign: { ...value.campaign, serverEvaluation: enabled
        ? { enabled: true, dataPath: 'validation-abc' } : { enabled: false } } };
    });
    const view = render(<ServerControl taskId="test" />);
    try {
      await act(async () => {});
      fireEvent.click(screen.getByRole('button', { name: 'Check evaluation setup' }));
      expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Checking…' })).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByRole('progressbar', { name: 'Evaluation setup check in progress' })).not.toHaveAttribute('aria-valuenow');
      expect(screen.getByText(enabled ? 'Checking server data and evaluating one batch…' : 'Checking client evaluation setup…')).toBeVisible();
      expect(screen.queryByText(/Check required before/)).not.toBeInTheDocument();
      expect(screen.getByText('0s elapsed')).toBeVisible();
      await act(async () => { jest.advanceTimersByTime(3000); });
      expect(screen.getByText('3s elapsed')).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: 'Checking…' }));
      expect(serverControlAPI.checkValidation).toHaveBeenCalledTimes(1);
      await act(async () => { finish({ success: true, status: 'ready' }); });
      expect(screen.queryByRole('progressbar', { name: 'Evaluation setup check in progress' })).not.toBeInTheDocument();
      expect(screen.queryByText(/s elapsed/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Check evaluation setup' })).not.toBeDisabled();
      expect(screen.getByText(enabled ? 'Evaluation setup ready · 1 batch checked' : 'Evaluation setup ready')).toBeVisible();
    } finally {
      view.unmount();
      jest.useRealTimers();
    }
  });

  test('request failure clears progress and allows a retry', async () => {
    let fail;
    serverControlAPI.checkValidation.mockImplementation(() => new Promise((_, reject) => { fail = reject; }));
    render(<ServerControl taskId="test" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Check evaluation setup' }));
    expect(screen.getByRole('progressbar', { name: 'Evaluation setup check in progress' })).toBeVisible();
    await act(async () => { fail(new Error('Evaluation request timed out')); });
    expect(screen.queryByRole('progressbar', { name: 'Evaluation setup check in progress' })).not.toBeInTheDocument();
    expect(screen.getByText('Evaluation request timed out')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Check evaluation setup' })).not.toBeDisabled();
  });

  test('changing Task clears progress and ignores the previous Task check result', async () => {
    let finish;
    serverControlAPI.checkValidation.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const view = render(<ServerControl taskId="first" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Check evaluation setup' }));
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled();
    await act(async () => { view.rerender(<ServerControl taskId="second" />); });
    expect(screen.queryByRole('progressbar', { name: 'Evaluation setup check in progress' })).not.toBeInTheDocument();
    await act(async () => { finish({ success: true, status: 'ready' }); });
    expect(screen.queryByText(/Evaluation setup ready/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check evaluation setup' })).not.toBeDisabled();
  });

  test('selecting an uploaded dataset updates only this unsaved Campaign and requires a check', async () => {
    render(<ServerControl taskId="test" />);
    const mode = await screen.findByLabelText('Global model evaluation');
    fireEvent.mouseDown(mode);
    fireEvent.click(screen.getByRole('option', { name: /Validation ON/ }));
    await waitFor(() => expect(serverControlAPI.getValidationData).toHaveBeenCalledWith('test'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh datasets' })).not.toBeDisabled());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Refresh datasets' })); });
    await waitFor(() => expect(serverControlAPI.getValidationData).toHaveBeenCalledTimes(2));
    const datasetSelect = screen.getByLabelText('Validation dataset');
    fireEvent.mouseDown(datasetSelect);
    fireEvent.click(screen.getByRole('option', { name: /Dataset abc/ }));
    expect(datasetSelect).toHaveTextContent('Dataset abc');
    expect(screen.getByRole('button', { name: 'Start FL server' })).toBeDisabled();
    expect(serverControlAPI.saveCampaign).not.toHaveBeenCalled();
  });

  test('explains the Release/data boundary and only requests server data when enabled', async () => {
    render(<ServerControl taskId="test" />);
    await screen.findByText('Global model metrics are aggregated from client evaluations, weighted by sample count.');
    expect(serverControlAPI.getValidationData).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Validation data directory')).not.toBeInTheDocument();
    const mode = screen.getByLabelText('Global model evaluation');
    fireEvent.mouseDown(mode);
    fireEvent.click(screen.getByRole('option', { name: /Validation ON/ }));
    await waitFor(() => expect(screen.getByLabelText('Validation dataset')).toHaveTextContent('Dataset abc'));
    expect(screen.getByText('Upload validation data in Agent Studio. It is stored on the FL server to evaluate the global model.')).toBeVisible();
    expect(screen.queryByText('Evaluation details')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Validation data directory')).not.toBeInTheDocument();
    expect(screen.queryByText(/Changing evaluation mode requires/)).not.toBeInTheDocument();
    expect(screen.getByText('Check required before saving')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Check evaluation setup' })).not.toBeDisabled();
    fireEvent.mouseDown(mode);
    fireEvent.click(screen.getByRole('option', { name: /Validation OFF/ }));
    expect(screen.queryByLabelText('Validation data directory')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check evaluation setup' })).not.toBeDisabled();
    expect(serverControlAPI.saveCampaign).not.toHaveBeenCalled();
  });

  test('short dataset labels retain exact paths in saved settings without a path editor', async () => {
    const dataPath = `validation-${'a'.repeat(64)}`;
    serverControlAPI.getValidationData.mockResolvedValue({ items: [{ dataPath, fileCount: 2 }] });
    render(<ServerControl taskId="test" />);
    fireEvent.mouseDown(await screen.findByLabelText('Global model evaluation'));
    fireEvent.click(screen.getByRole('option', { name: /Validation ON/ }));
    await waitFor(() => expect(screen.getByLabelText('Validation dataset')).toHaveTextContent('Dataset aaaaaaaa…'));
    expect(screen.queryByLabelText('Validation data directory')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Validation dataset')).toHaveTextContent('Dataset aaaaaaaa… · 2 files');
    expect(screen.getByLabelText('Validation dataset')).not.toHaveTextContent(dataPath);
    expect(screen.getByRole('button', { name: 'Save campaign' })).toBeDisabled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check evaluation setup' })); });
    expect(screen.getByRole('button', { name: 'Save campaign' })).not.toBeDisabled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save campaign' })); });
    await waitFor(() => expect(serverControlAPI.saveCampaign).toHaveBeenCalledWith('test', expect.objectContaining({
      serverEvaluation: { enabled: true, dataPath },
    })));
  });

  test('empty upload list blocks the ON check but OFF requires no dataset', async () => {
    serverControlAPI.getValidationData.mockResolvedValue({ items: [] });
    render(<ServerControl taskId="test" />);
    const mode = await screen.findByLabelText('Global model evaluation');
    fireEvent.mouseDown(mode);
    fireEvent.click(screen.getByRole('option', { name: /Validation ON/ }));
    await screen.findByText('Upload a dataset in Agent Studio');
    expect(screen.getByText(/In Agent Studio, open this Task/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Check evaluation setup' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save campaign' })).toBeDisabled();
    fireEvent.mouseDown(mode);
    fireEvent.click(screen.getByRole('option', { name: /Validation OFF/ }));
    expect(screen.queryByLabelText('Validation dataset')).not.toBeInTheDocument();
    expect(screen.getByText(/weighted by sample count/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Check evaluation setup' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save campaign' })).not.toBeDisabled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save campaign' })); });
    await waitFor(() => expect(serverControlAPI.saveCampaign).toHaveBeenCalledWith('test', expect.objectContaining({
      serverEvaluation: { enabled: false },
    })));
  });

  test('shows the actual OFF default and offers only ON/OFF without auto-saving', async () => {
    render(<ServerControl taskId="test" />);
    const mode = await screen.findByLabelText('Global model evaluation');
    expect(mode).toHaveTextContent('Validation OFF');
    expect(serverControlAPI.saveCampaign).not.toHaveBeenCalled();
    fireEvent.mouseDown(mode);
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.queryByRole('option', { name: 'Release default' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: /Validation OFF/ }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save campaign' })); });
    await waitFor(() => expect(serverControlAPI.saveCampaign).toHaveBeenCalled());
    expect(serverControlAPI.saveCampaign.mock.calls[0][1].serverEvaluation).toEqual({ enabled: false });
  });

  test('an ON Release default selects uploaded data but still requires a check before save', async () => {
    const get = serverControlAPI.getCampaign.getMockImplementation();
    serverControlAPI.getCampaign.mockImplementation(async () => ({ ...await get(), evaluationDefaults: { supported: true, enabled: true } }));
    render(<ServerControl taskId="test" />);
    await waitFor(() => expect(screen.getByLabelText('Global model evaluation')).toHaveTextContent('Validation ON'));
    await waitFor(() => expect(screen.getByLabelText('Validation dataset')).toHaveTextContent('Dataset abc'));
    expect(screen.getByRole('button', { name: 'Save campaign' })).toBeDisabled();
    expect(serverControlAPI.saveCampaign).not.toHaveBeenCalled();
  });

  test('unknown old Release settings are not silently shown or saved as OFF', async () => {
    const get = serverControlAPI.getCampaign.getMockImplementation();
    serverControlAPI.getCampaign.mockImplementation(async () => ({ ...await get(), evaluationDefaults: {
      supported: false, enabled: null, reason: 'Publish a compatible Release to use Validation ON/OFF.',
    } }));
    render(<ServerControl taskId="test" />);
    const mode = await screen.findByLabelText('Global model evaluation');
    expect(mode).toHaveTextContent('Evaluation mode unavailable');
    expect(mode).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Publish a compatible Release to use Validation ON/OFF.')).toBeVisible();
    expect(serverControlAPI.saveCampaign).not.toHaveBeenCalled();
  });

  test('saved Campaign mode takes precedence over the Release default', async () => {
    const get = serverControlAPI.getCampaign.getMockImplementation();
    serverControlAPI.getCampaign.mockImplementation(async () => {
      const value = await get();
      return { ...value, campaign: { ...value.campaign, serverEvaluation: { enabled: false } },
        evaluationDefaults: { supported: true, enabled: true } };
    });
    render(<ServerControl taskId="test" />);
    expect(await screen.findByLabelText('Global model evaluation')).toHaveTextContent('Validation OFF');
    expect(screen.getByRole('button', { name: 'Save campaign' })).toBeDisabled();
  });

  test('validation data needs a successful check; editing invalidates readiness', async () => {
    serverControlAPI.getCampaign.mockResolvedValue({
      campaign: { schemaVersion: 1, rounds: 2, clientsPerRound: 1,
        strategy: { name: 'FedAvg', parameters: {} },
        serverEvaluation: { enabled: true, dataPath: 'ecg' } },
      immutableReleaseRequired: true, persisted: true, releaseId: 'release-1', supportedStrategies: ['FedAvg'],
    });
    serverControlAPI.checkValidation.mockResolvedValue({ success: true, status: 'ready', samples: 20 });
    render(<ServerControl taskId="test" />);
    await waitFor(() => expect(screen.getByLabelText('Validation dataset')).toHaveTextContent('Current server dataset'));
    expect(screen.getByRole('button', { name: 'Start FL server' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Check evaluation setup' }));
    await screen.findByText(/Evaluation setup ready/);
    expect(serverControlAPI.checkValidation).toHaveBeenCalledWith('test', expect.objectContaining({
      serverEvaluation: { enabled: true, dataPath: 'ecg' },
    }));
    expect(screen.getByRole('button', { name: 'Start FL server' })).not.toBeDisabled();
    fireEvent.mouseDown(screen.getByLabelText('Validation dataset'));
    fireEvent.click(screen.getByRole('option', { name: /Dataset abc/ }));
    expect(screen.getByRole('button', { name: 'Start FL server' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save campaign' })).toBeDisabled();
    expect(screen.queryByText(/Evaluation setup ready/)).not.toBeInTheDocument();
  });

  test('failed validation check blocks start and shows the error', async () => {
    serverControlAPI.getCampaign.mockResolvedValue({
      campaign: { schemaVersion: 1, rounds: 2, clientsPerRound: 1, strategy: { name: 'FedAvg' },
        serverEvaluation: { enabled: true, dataPath: 'missing' } },
      immutableReleaseRequired: true, persisted: true, releaseId: 'release-1',
    });
    serverControlAPI.checkValidation.mockRejectedValue(new Error('Validation directory is empty'));
    render(<ServerControl taskId="test" />);
    await waitFor(() => expect(screen.getByLabelText('Validation dataset')).toHaveTextContent('Current server dataset'));
    fireEvent.click(screen.getByRole('button', { name: 'Check evaluation setup' }));
    await screen.findByText(/Validation data is missing or empty/);
    expect(screen.getByText(/In Agent Studio, open this Task/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Start FL server' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save campaign' })).toBeDisabled();
  });

  test('a late successful check cannot unlock an edited ON campaign', async () => {
    let finishCheck;
    serverControlAPI.checkValidation.mockImplementation(() => new Promise(resolve => { finishCheck = resolve; }));
    render(<ServerControl taskId="test" />);
    fireEvent.mouseDown(await screen.findByLabelText('Global model evaluation'));
    fireEvent.click(screen.getByRole('option', { name: /Validation ON/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check evaluation setup' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Check evaluation setup' }));
    fireEvent.change(screen.getByLabelText('Rounds'), { target: { value: '3' } });
    await act(async () => { finishCheck({ success: true, status: 'ready' }); });
    expect(screen.getByRole('button', { name: 'Save campaign' })).toBeDisabled();
    expect(screen.queryByText(/Evaluation setup ready/)).not.toBeInTheDocument();
  });

  test.each(['ON', 'OFF'])('an unsaved %s draft can prepare a missing server without saving the draft', async (mode) => {
    const originalGetCampaign = serverControlAPI.getCampaign.getMockImplementation();
    serverControlAPI.getCampaign.mockImplementation(async () => ({ ...await originalGetCampaign(), persisted: false }));
    serverControlAPI.getServerStatus.mockResolvedValue({ data: {
      deployment: { error: 'Deployment not found' }, pods: [], pvc: { error: 'PVC not found' },
    } });
    serverControlAPI.getConnectionInfo.mockResolvedValue({});
    serverControlAPI.checkServerReady.mockResolvedValue({ ready: false });
    render(<ServerControl taskId="test" />);
    fireEvent.mouseDown(await screen.findByLabelText('Global model evaluation'));
    fireEvent.click(screen.getByRole('option', { name: new RegExp(`Validation ${mode}`) }));
    if (mode === 'ON') {
      await waitFor(() => expect(screen.getByLabelText('Validation dataset')).toHaveTextContent('Dataset abc'));
      expect(screen.getByRole('button', { name: 'Save campaign' })).toBeDisabled();
    }
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create scalable server' })).not.toBeDisabled());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create scalable server' })); });
    expect(serverControlAPI.createScalableServerFromSaved).toHaveBeenCalledWith('test');
    expect(serverControlAPI.saveCampaign).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Global model evaluation')).toHaveTextContent(`Validation ${mode}`);
    expect(screen.getByRole('button', { name: 'Create scalable server' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Create scalable server' }));
    expect(serverControlAPI.createScalableServerFromSaved).toHaveBeenCalledTimes(1);
  });

  test.each(['ON', 'OFF'])('existing healthy runtime blocks Create regardless of %s or dirty Campaign', async (mode) => {
    render(<ServerControl taskId="test" />);
    fireEvent.mouseDown(await screen.findByLabelText('Global model evaluation'));
    fireEvent.click(screen.getByRole('option', { name: new RegExp(`Validation ${mode}`) }));
    fireEvent.change(screen.getByLabelText('Rounds'), { target: { value: '3' } });
    expect(screen.getByRole('button', { name: 'Create scalable server' })).toBeDisabled();
    expect(serverControlAPI.createScalableServerFromSaved).not.toHaveBeenCalled();
  });

  test('loader errors are not misreported as missing uploads', async () => {
    serverControlAPI.checkValidation.mockRejectedValue(new Error('Implement gl_model_torch_validation()'));
    render(<ServerControl taskId="test" />);
    fireEvent.mouseDown(await screen.findByLabelText('Global model evaluation'));
    fireEvent.click(screen.getByRole('option', { name: /Validation ON/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check evaluation setup' })).not.toBeDisabled());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check evaluation setup' })); });
    expect(screen.getByText('Implement gl_model_torch_validation()')).toBeVisible();
    expect(screen.queryByText(/Validation data is missing or empty/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save campaign' })).toBeDisabled();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    serverControlAPI.checkValidation.mockResolvedValue({ success: true, status: 'ready', checkedBatches: 1 });
    serverControlAPI.createScalableServerFromSaved.mockResolvedValue({ message: 'Server prepared.' });
    serverControlAPI.getValidationData.mockResolvedValue({ items: [{ dataPath: 'validation-abc', fileCount: 2 }] });
    serverControlAPI.getServerStatus.mockResolvedValue({
      data: {
        deployment: {
          replicas: 1,
          ready_replicas: 1,
          available_replicas: 1,
        },
        pods: [{
          name: 'fl-server-deploy-demo-abc123',
          phase: 'Running',
          ready: true,
        }],
        pvc: {
          name: 'fl-data-demo',
          phase: 'Bound',
          capacity: '20Gi',
        },
        fl_server_status: {
          status: 'FL Server created',
          yaml_saved: true,
          cpu: '2',
          memory: '4Gi',
          port: 40026,
          external_ip: '192.168.10.15',
          service_name: 'fl-server-service-demo',
          deployment: 'fl-server-deploy-demo',
          pvc: 'fl-data-demo',
        },
      },
    });
    serverControlAPI.getConnectionInfo.mockResolvedValue({
      status: 'FL Server created',
      port: 40026,
      external_ip: '192.168.10.15',
      server_address: '192.168.10.15:40026',
      server_type: 'scalable',
      service_name: 'fl-server-service-demo',
      deployment: 'fl-server-deploy-demo',
    });
    serverControlAPI.checkServerReady.mockResolvedValue({
      ready: false,
      fl_ready: false,
      status: 'FL Server created',
    });
    serverControlAPI.getCampaign.mockResolvedValue({
      campaign: {
        schemaVersion: 1,
        rounds: 2,
        clientsPerRound: 1,
        strategy: { name: 'FedAvg', parameters: {} },
      },
      supportedStrategies: ['FedAvg'],
      evaluationDefaults: { supported: true, enabled: false },
      releaseId: 'release-1',
      immutableReleaseRequired: true,
      persisted: true,
      savedAt: '2026-08-20T00:00:00.000Z',
    });
    serverControlAPI.saveCampaign.mockResolvedValue({
      message: 'Federated campaign saved.',
      campaign: {
        schemaVersion: 1,
        rounds: 4,
        clientsPerRound: 1,
        strategy: { name: 'FedAvg', parameters: {} },
      },
      persisted: true,
      savedAt: '2026-08-20T01:00:00.000Z',
    });
  });

  test('renders allocated connection, resource, Pod, and PVC details', async () => {
    render(<ServerControl taskId="demo" />);

    expect(await screen.findByText('192.168.10.15:40026')).toBeInTheDocument();
    expect(screen.getByText('40026')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('4Gi')).toBeInTheDocument();
    expect(screen.getByText('20Gi allocated')).toBeInTheDocument();
    expect(screen.getByText('fl-server-service-demo')).toBeInTheDocument();
    expect(screen.getByText('fl-server-deploy-demo-abc123')).toBeInTheDocument();
    expect(screen.getByText('Federated campaign')).toBeInTheDocument();
  });

  test('refreshes completed runtime without reload and preserves unsaved Campaign edits', async () => {
    jest.useFakeTimers();
    serverControlAPI.checkServerReady.mockResolvedValue({ ready: true, fl_ready: true, status: 'FL Server Running' });
    const view = render(<ServerControl taskId="demo" />);
    try {
      await act(async () => {});
      expect(screen.getByRole('button', { name: 'Start FL server' })).toBeDisabled();
      fireEvent.change(screen.getByLabelText('Rounds'), { target: { value: '3' } });
      serverControlAPI.checkServerReady.mockResolvedValue({ ready: false, fl_ready: false, status: 'FL Server Finished' });
      await act(async () => { jest.advanceTimersByTime(5000); });
      expect(screen.getAllByText('FL Server Finished').length).toBeGreaterThan(0);
      expect(screen.getByLabelText('Rounds')).toHaveValue(3);
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
      const count = serverControlAPI.checkServerReady.mock.calls.length;
      view.unmount();
      await act(async () => { jest.advanceTimersByTime(10000); });
      expect(serverControlAPI.checkServerReady).toHaveBeenCalledTimes(count);
    } finally {
      view.unmount();
      jest.useRealTimers();
    }
  });

  test('hides Federated campaign for a FedOps 1.2 Legacy Task', async () => {
    serverControlAPI.getCampaign.mockResolvedValue({
      campaign: {
        schemaVersion: 1,
        rounds: 2,
        clientsPerRound: 1,
        strategy: { name: 'FedAvg', parameters: {} },
      },
      supportedStrategies: ['FedAvg'],
      releaseId: null,
      immutableReleaseRequired: false,
    });

    render(<ServerControl taskId="legacy-demo" />);

    expect(await screen.findByText('192.168.10.15:40026')).toBeInTheDocument();
    expect(screen.queryByText('Federated campaign')).not.toBeInTheDocument();
  });

  test('saves the Campaign independently before runtime start', async () => {
    render(<ServerControl taskId="demo" />);

    const rounds = await screen.findByLabelText('Rounds');
    fireEvent.change(rounds, { target: { value: '4' } });
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save campaign' }));
    await waitFor(() => expect(serverControlAPI.saveCampaign).toHaveBeenCalledWith(
      'demo',
      expect.objectContaining({ rounds: 4, clientsPerRound: 1 }),
    ));
    expect(await screen.findByText('Federated campaign saved.')).toBeInTheDocument();
  });
});
