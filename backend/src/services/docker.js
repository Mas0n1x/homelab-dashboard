import Docker from 'dockerode';

// Default local Docker instance
const defaultDocker = new Docker({ socketPath: '/var/run/docker.sock' });

function getDockerInstance(dockerInstance) {
  return dockerInstance || defaultDocker;
}

export async function getContainers(dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
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
      project: container.Labels?.['com.docker.compose.project'] || null,
      service: container.Labels?.['com.docker.compose.service'] || null,
      labels: container.Labels || {}
    }));
  } catch (error) {
    console.error('Error fetching containers:', error.message);
    throw error;
  }
}

export async function getContainerStats(containerId, dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
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

export async function startContainer(containerId, dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
  try {
    const container = docker.getContainer(containerId);
    await container.start();
    return { success: true, message: 'Container started' };
  } catch (error) {
    console.error('Error starting container:', error.message);
    throw error;
  }
}

export async function stopContainer(containerId, dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
  try {
    const container = docker.getContainer(containerId);
    await container.stop();
    return { success: true, message: 'Container stopped' };
  } catch (error) {
    console.error('Error stopping container:', error.message);
    throw error;
  }
}

export async function restartContainer(containerId, dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
  try {
    const container = docker.getContainer(containerId);
    await container.restart();
    return { success: true, message: 'Container restarted' };
  } catch (error) {
    console.error('Error restarting container:', error.message);
    throw error;
  }
}

export async function updateRestartPolicy(containerId, policy, dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
  try {
    const container = docker.getContainer(containerId);
    await container.update({ RestartPolicy: { Name: policy, MaximumRetryCount: policy === 'on-failure' ? 5 : 0 } });
    return { success: true, message: `Restart policy updated to ${policy}` };
  } catch (error) {
    console.error('Error updating restart policy:', error.message);
    throw error;
  }
}

export async function getContainerLogs(containerId, tail = 100, dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
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

export async function getDockerInfo(dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
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

export async function getContainerDetails(containerId, dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
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

export async function getImages(dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
  try {
    const images = await docker.listImages({ all: true });
    const containers = await docker.listContainers({ all: true });

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

export async function deleteImage(imageId, force = false, dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
  try {
    const image = docker.getImage(imageId);
    await image.remove({ force });
    return { success: true, message: 'Image deleted' };
  } catch (error) {
    console.error('Error deleting image:', error.message);
    throw error;
  }
}

export async function pruneImages(dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
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

export async function getVolumes(dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
  try {
    const { Volumes } = await docker.listVolumes();
    const containers = await docker.listContainers({ all: true });

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

export async function deleteVolume(volumeName, force = false, dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
  try {
    const volume = docker.getVolume(volumeName);
    await volume.remove({ force });
    return { success: true, message: 'Volume deleted' };
  } catch (error) {
    console.error('Error deleting volume:', error.message);
    throw error;
  }
}

export async function pruneVolumes(dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
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

export async function getNetworks(dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
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

export async function systemPrune(options = {}, dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
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

    return { success: true, results };
  } catch (error) {
    console.error('Error pruning system:', error.message);
    throw error;
  }
}

// ==================== COMPOSE ACTIONS ====================

export async function getComposeProjects(dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
  try {
    const containers = await docker.listContainers({ all: true });
    const projects = new Map();

    containers.forEach(c => {
      const project = c.Labels?.['com.docker.compose.project'] || null;
      if (!project) return;
      if (!projects.has(project)) {
        projects.set(project, {
          name: project,
          workingDir: c.Labels?.['com.docker.compose.project.working_dir'] || null,
          configFiles: c.Labels?.['com.docker.compose.project.config_files'] || null,
          containers: [],
        });
      }
      projects.get(project).containers.push({
        id: c.Id,
        name: c.Names[0]?.replace(/^\//, '') || 'unknown',
        service: c.Labels?.['com.docker.compose.service'] || '',
        state: c.State,
        image: c.Image,
      });
    });

    return Array.from(projects.values());
  } catch (error) {
    console.error('Error fetching compose projects:', error.message);
    throw error;
  }
}

export async function composeAction(projectName, action, dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
  try {
    const containers = await docker.listContainers({ all: true });
    const projectContainers = containers.filter(
      c => c.Labels?.['com.docker.compose.project'] === projectName
    );

    const results = [];
    for (const c of projectContainers) {
      const container = docker.getContainer(c.Id);
      try {
        if (action === 'stop') await container.stop();
        else if (action === 'start') await container.start();
        else if (action === 'restart') await container.restart();
        results.push({ id: c.Id, name: c.Names[0]?.replace(/^\//, ''), success: true });
      } catch (e) {
        results.push({ id: c.Id, name: c.Names[0]?.replace(/^\//, ''), success: false, error: e.message });
      }
    }

    return { project: projectName, action, results };
  } catch (error) {
    console.error('Error performing compose action:', error.message);
    throw error;
  }
}

// ==================== COMPOSE FILE EDITOR ====================

export async function getComposeFile(projectName, dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
  const containers = await docker.listContainers({ all: true });
  const projectContainer = containers.find(
    c => c.Labels?.['com.docker.compose.project'] === projectName
  );
  if (!projectContainer) throw new Error('Project not found');

  const configFiles = projectContainer.Labels?.['com.docker.compose.project.config_files'];
  const workingDir = projectContainer.Labels?.['com.docker.compose.project.working_dir'];

  if (!configFiles || !workingDir) {
    throw new Error('Compose file path not found in container labels');
  }

  // The working dir is a host path - map it to /host prefix
  const hostPath = configFiles.split(',')[0];
  const mappedPath = `/host${hostPath}`;

  const { readFileSync } = await import('fs');
  try {
    const content = readFileSync(mappedPath, 'utf-8');
    return { content, path: hostPath, workingDir };
  } catch (error) {
    throw new Error(`Cannot read compose file: ${error.message}`);
  }
}

export async function saveComposeFile(projectName, content, dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
  const containers = await docker.listContainers({ all: true });
  const projectContainer = containers.find(
    c => c.Labels?.['com.docker.compose.project'] === projectName
  );
  if (!projectContainer) throw new Error('Project not found');

  const configFiles = projectContainer.Labels?.['com.docker.compose.project.config_files'];
  if (!configFiles) throw new Error('Compose file path not found');

  const hostPath = configFiles.split(',')[0];
  const mappedPath = `/host${hostPath}`;

  const { writeFileSync, copyFileSync, existsSync } = await import('fs');

  // Create backup before saving
  const backupPath = `${mappedPath}.bak`;
  if (existsSync(mappedPath)) {
    copyFileSync(mappedPath, backupPath);
  }

  writeFileSync(mappedPath, content, 'utf-8');
  return { path: hostPath, saved: true };
}

// ==================== IMAGE UPDATE CHECK ====================

export async function checkImageUpdates(dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
  try {
    const containers = await docker.listContainers({ all: true });
    const updates = [];

    for (const c of containers) {
      const image = c.Image;
      if (!image || image.startsWith('sha256:')) continue;

      try {
        const [repo, tag = 'latest'] = image.includes(':') ? image.split(':') : [image, 'latest'];
        const pullStream = await docker.pull(`${repo}:${tag}`);
        await new Promise((resolve, reject) => {
          docker.modem.followProgress(pullStream, (err, output) => {
            if (err) reject(err);
            else resolve(output);
          });
        });

        const currentInspect = await docker.getImage(c.ImageID).inspect();
        const latestInspect = await docker.getImage(`${repo}:${tag}`).inspect();

        if (currentInspect.Id !== latestInspect.Id) {
          updates.push({
            containerId: c.Id,
            containerName: c.Names[0]?.replace(/^\//, ''),
            image,
            currentId: currentInspect.Id.substring(0, 12),
            latestId: latestInspect.Id.substring(0, 12),
            hasUpdate: true,
          });
        }
      } catch {
        // Skip images that can't be pulled
      }
    }

    return updates;
  } catch (error) {
    console.error('Error checking image updates:', error.message);
    throw error;
  }
}

export async function pullAndRecreate(containerId, dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
  try {
    const container = docker.getContainer(containerId);
    const inspect = await container.inspect();
    const image = inspect.Config.Image;

    const pullStream = await docker.pull(image);
    await new Promise((resolve, reject) => {
      docker.modem.followProgress(pullStream, (err, output) => {
        if (err) reject(err);
        else resolve(output);
      });
    });

    try { await container.stop(); } catch {}
    await container.remove();

    const newContainer = await docker.createContainer({
      ...inspect.Config,
      name: inspect.Name.replace(/^\//, ''),
      HostConfig: inspect.HostConfig,
      NetworkingConfig: { EndpointsConfig: inspect.NetworkSettings.Networks },
    });

    await newContainer.start();
    return { success: true, newId: newContainer.id };
  } catch (error) {
    console.error('Error pulling and recreating:', error.message);
    throw error;
  }
}

// ==================== DISK USAGE ====================

export async function getDiskUsage(dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
  try {
    const df = await docker.df();

    const containers = (df.Containers || []).map(c => ({
      id: c.Id?.substring(0, 12),
      name: c.Names?.[0]?.replace(/^\//, '') || 'unknown',
      size: c.SizeRw || 0,
      rootFs: c.SizeRootFs || 0,
      state: c.State,
    }));

    const images = (df.Images || []).map(i => ({
      id: i.Id?.replace('sha256:', '').substring(0, 12),
      repo: i.RepoTags?.[0] || '<none>',
      size: i.Size || 0,
      shared: i.SharedSize || 0,
      unique: (i.Size || 0) - (i.SharedSize || 0),
    }));

    const volumes = (df.Volumes || []).map(v => ({
      name: v.Name,
      size: v.UsageData?.Size || 0,
      refCount: v.UsageData?.RefCount || 0,
    }));

    const buildCache = (df.BuildCache || []).reduce((sum, b) => sum + (b.Size || 0), 0);

    return { containers, images, volumes, buildCache };
  } catch (error) {
    console.error('Error fetching disk usage:', error.message);
    throw error;
  }
}

// ==================== CONTAINER STATS BATCH ====================

export async function getAllContainerStats(dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
  try {
    const containers = await docker.listContainers({ filters: { status: ['running'] } });
    const statsPromises = containers.map(async (c) => {
      try {
        const container = docker.getContainer(c.Id);
        const stats = await container.stats({ stream: false });

        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
        const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
        const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100 : 0;
        const memUsage = stats.memory_stats.usage || 0;
        const memLimit = stats.memory_stats.limit || 1;

        return {
          id: c.Id.substring(0, 12),
          name: c.Names[0]?.replace(/^\//, ''),
          cpu: parseFloat(cpuPercent.toFixed(2)),
          memUsage,
          memLimit,
          memPercent: parseFloat(((memUsage / memLimit) * 100).toFixed(2)),
        };
      } catch {
        return null;
      }
    });

    const results = await Promise.all(statsPromises);
    return results.filter(Boolean);
  } catch (error) {
    console.error('Error fetching all container stats:', error.message);
    return [];
  }
}

// ==================== PORTS OVERVIEW ====================

export async function getPortsOverview(dockerInstance) {
  const docker = getDockerInstance(dockerInstance);
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
