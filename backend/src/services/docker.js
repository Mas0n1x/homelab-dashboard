import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export async function getContainers() {
  try {
    const containers = await docker.listContainers({ all: true });

    return containers.map(container => ({
      id: container.Id,
      shortId: container.Id.substring(0, 12),
      name: container.Names[0]?.replace(/^\//, '') || 'unknown',
      image: container.Image,
      state: container.State,
      status: container.Status,
      created: container.Created,
      ports: container.Ports.map(p => ({
        private: p.PrivatePort,
        public: p.PublicPort,
        type: p.Type
      }))
    }));
  } catch (error) {
    console.error('Error fetching containers:', error.message);
    throw error;
  }
}

export async function getContainerStats(containerId) {
  try {
    const container = docker.getContainer(containerId);
    const stats = await container.stats({ stream: false });

    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100 : 0;

    const memUsage = stats.memory_stats.usage || 0;
    const memLimit = stats.memory_stats.limit || 1;
    const memPercent = (memUsage / memLimit) * 100;

    return {
      cpu: cpuPercent.toFixed(2),
      memory: {
        usage: memUsage,
        limit: memLimit,
        percent: memPercent.toFixed(2)
      },
      network: stats.networks || {}
    };
  } catch (error) {
    console.error('Error fetching container stats:', error.message);
    throw error;
  }
}

export async function startContainer(containerId) {
  try {
    const container = docker.getContainer(containerId);
    await container.start();
    return { success: true, message: 'Container started' };
  } catch (error) {
    console.error('Error starting container:', error.message);
    throw error;
  }
}

export async function stopContainer(containerId) {
  try {
    const container = docker.getContainer(containerId);
    await container.stop();
    return { success: true, message: 'Container stopped' };
  } catch (error) {
    console.error('Error stopping container:', error.message);
    throw error;
  }
}

export async function restartContainer(containerId) {
  try {
    const container = docker.getContainer(containerId);
    await container.restart();
    return { success: true, message: 'Container restarted' };
  } catch (error) {
    console.error('Error restarting container:', error.message);
    throw error;
  }
}

export async function getContainerLogs(containerId, tail = 100) {
  try {
    const container = docker.getContainer(containerId);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: tail,
      timestamps: true
    });

    return logs.toString('utf8');
  } catch (error) {
    console.error('Error fetching container logs:', error.message);
    throw error;
  }
}

export async function getDockerInfo() {
  try {
    const info = await docker.info();
    return {
      containers: info.Containers,
      containersRunning: info.ContainersRunning,
      containersPaused: info.ContainersPaused,
      containersStopped: info.ContainersStopped,
      images: info.Images,
      dockerVersion: info.ServerVersion,
      os: info.OperatingSystem,
      architecture: info.Architecture,
      memTotal: info.MemTotal,
      cpus: info.NCPU
    };
  } catch (error) {
    console.error('Error fetching Docker info:', error.message);
    throw error;
  }
}
