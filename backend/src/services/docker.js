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
      })),
      // Compose project info from labels
      project: container.Labels?.['com.docker.compose.project'] || null,
      service: container.Labels?.['com.docker.compose.service'] || null
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

export async function getContainerDetails(containerId) {
  try {
    const container = docker.getContainer(containerId);
    const inspect = await container.inspect();

    return {
      id: inspect.Id,
      shortId: inspect.Id.substring(0, 12),
      name: inspect.Name.replace(/^\//, ''),
      image: inspect.Config.Image,
      state: inspect.State.Status,
      running: inspect.State.Running,
      paused: inspect.State.Paused,
      restarting: inspect.State.Restarting,
      pid: inspect.State.Pid,
      exitCode: inspect.State.ExitCode,
      startedAt: inspect.State.StartedAt,
      finishedAt: inspect.State.FinishedAt,
      restartCount: inspect.RestartCount,
      platform: inspect.Platform,
      created: inspect.Created,
      ports: Object.entries(inspect.NetworkSettings.Ports || {}).map(([containerPort, hostBindings]) => ({
        container: containerPort,
        host: hostBindings ? hostBindings.map(h => `${h.HostIp || '0.0.0.0'}:${h.HostPort}`).join(', ') : null
      })),
      mounts: inspect.Mounts.map(m => ({
        type: m.Type,
        source: m.Source,
        destination: m.Destination,
        mode: m.Mode,
        rw: m.RW
      })),
      env: inspect.Config.Env || [],
      networks: Object.keys(inspect.NetworkSettings.Networks || {}),
      labels: inspect.Config.Labels || {}
    };
  } catch (error) {
    console.error('Error fetching container details:', error.message);
    throw error;
  }
}

// ==================== IMAGES ====================

export async function getImages() {
  try {
    const images = await docker.listImages({ all: true });
    const containers = await docker.listContainers({ all: true });

    // Get image IDs that are in use
    const usedImageIds = new Set(containers.map(c => c.ImageID));

    return images.map(image => ({
      id: image.Id,
      shortId: image.Id.replace('sha256:', '').substring(0, 12),
      repoTags: image.RepoTags || ['<none>:<none>'],
      repoDigests: image.RepoDigests || [],
      size: image.Size,
      created: image.Created,
      inUse: usedImageIds.has(image.Id),
      labels: image.Labels || {}
    }));
  } catch (error) {
    console.error('Error fetching images:', error.message);
    throw error;
  }
}

export async function deleteImage(imageId, force = false) {
  try {
    const image = docker.getImage(imageId);
    await image.remove({ force });
    return { success: true, message: 'Image deleted' };
  } catch (error) {
    console.error('Error deleting image:', error.message);
    throw error;
  }
}

export async function pruneImages() {
  try {
    const result = await docker.pruneImages({ filters: { dangling: { false: true } } });
    return {
      success: true,
      imagesDeleted: result.ImagesDeleted || [],
      spaceReclaimed: result.SpaceReclaimed || 0
    };
  } catch (error) {
    console.error('Error pruning images:', error.message);
    throw error;
  }
}

// ==================== VOLUMES ====================

export async function getVolumes() {
  try {
    const { Volumes } = await docker.listVolumes();
    const containers = await docker.listContainers({ all: true });

    // Get volumes that are in use
    const usedVolumes = new Set();
    containers.forEach(c => {
      (c.Mounts || []).forEach(m => {
        if (m.Type === 'volume' && m.Name) {
          usedVolumes.add(m.Name);
        }
      });
    });

    return Promise.all((Volumes || []).map(async (vol) => {
      let size = null;
      try {
        const volume = docker.getVolume(vol.Name);
        const inspect = await volume.inspect();
        size = inspect.UsageData?.Size || null;
      } catch (e) {
        // Size not available
      }

      return {
        name: vol.Name,
        driver: vol.Driver,
        mountpoint: vol.Mountpoint,
        created: vol.CreatedAt,
        scope: vol.Scope,
        labels: vol.Labels || {},
        inUse: usedVolumes.has(vol.Name),
        size
      };
    }));
  } catch (error) {
    console.error('Error fetching volumes:', error.message);
    throw error;
  }
}

export async function deleteVolume(volumeName, force = false) {
  try {
    const volume = docker.getVolume(volumeName);
    await volume.remove({ force });
    return { success: true, message: 'Volume deleted' };
  } catch (error) {
    console.error('Error deleting volume:', error.message);
    throw error;
  }
}

export async function pruneVolumes() {
  try {
    const result = await docker.pruneVolumes();
    return {
      success: true,
      volumesDeleted: result.VolumesDeleted || [],
      spaceReclaimed: result.SpaceReclaimed || 0
    };
  } catch (error) {
    console.error('Error pruning volumes:', error.message);
    throw error;
  }
}

// ==================== NETWORKS ====================

export async function getNetworks() {
  try {
    const networks = await docker.listNetworks();

    return Promise.all(networks.map(async (net) => {
      const network = docker.getNetwork(net.Id);
      const inspect = await network.inspect();

      return {
        id: net.Id,
        shortId: net.Id.substring(0, 12),
        name: net.Name,
        driver: net.Driver,
        scope: net.Scope,
        internal: inspect.Internal || false,
        ipam: inspect.IPAM?.Config || [],
        containers: Object.entries(inspect.Containers || {}).map(([id, info]) => ({
          id,
          name: info.Name,
          ipv4: info.IPv4Address,
          ipv6: info.IPv6Address
        })),
        created: inspect.Created,
        labels: net.Labels || {}
      };
    }));
  } catch (error) {
    console.error('Error fetching networks:', error.message);
    throw error;
  }
}

// ==================== SYSTEM ====================

export async function systemPrune(options = {}) {
  try {
    const results = {
      containers: null,
      images: null,
      volumes: null,
      networks: null
    };

    if (options.containers) {
      results.containers = await docker.pruneContainers();
    }
    if (options.images) {
      results.images = await docker.pruneImages({ filters: { dangling: { false: true } } });
    }
    if (options.volumes) {
      results.volumes = await docker.pruneVolumes();
    }
    if (options.networks) {
      results.networks = await docker.pruneNetworks();
    }

    return {
      success: true,
      results
    };
  } catch (error) {
    console.error('Error pruning system:', error.message);
    throw error;
  }
}

// ==================== PORTS OVERVIEW ====================

export async function getPortsOverview() {
  try {
    const containers = await docker.listContainers({ all: true });
    const ports = [];

    containers.forEach(container => {
      (container.Ports || []).forEach(port => {
        if (port.PublicPort) {
          ports.push({
            containerName: container.Names[0]?.replace(/^\//, '') || 'unknown',
            containerId: container.Id.substring(0, 12),
            containerState: container.State,
            publicPort: port.PublicPort,
            privatePort: port.PrivatePort,
            type: port.Type,
            ip: port.IP || '0.0.0.0'
          });
        }
      });
    });

    return ports.sort((a, b) => a.publicPort - b.publicPort);
  } catch (error) {
    console.error('Error fetching ports overview:', error.message);
    throw error;
  }
}
