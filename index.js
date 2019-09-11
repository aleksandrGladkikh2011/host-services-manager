const express = require('express');
const { exec } = require('child_process');
// const mock = require('./mock');

const app = express();
const serviceExceptions = (process.env.EXCEPTIONS && process.env.EXCEPTIONS.split(',')) || [];
console.log(`Exceptions list: ${serviceExceptions.join()}`);

const execCmd = async cmd =>
  new Promise((resolve, reject) => {
    exec(cmd, (error, stdout /* , stderr */) => {
      if (error && error.code !== 1) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });

const getAvailableServices = async () => {
  let list = await execCmd('/usr/bin/sudo /usr/bin/sv status /etc/service/*');
  // list = mock.svStatusResult;
  list = list.split('\n');

  const services = list
    .filter(line => Boolean(line))
    .map((line) => {
      const [status, path] = line.split(': ');
      return {
        name: path.slice(13),
        status,
      };
    })
    .filter((service) => {
      const show = !serviceExceptions.includes(service.name);
      // console.log(show, service.name);
      return show;
    });

  return services;
};

const chefStatus = async () => {
  const commandResult = await execCmd('/usr/bin/sudo pgrep chef-client');
  const rows = commandResult.split('\n').length;
  const status = rows > 2 ? 'run' : 'stopped';
  console.log(`chefStatus: ${status} ${rows} '${commandResult}'`);
  return status;
};

const hostname = async () => {
  const commandResult = await execCmd('/bin/hostname');
  return commandResult;
};

app.use(express.static('static'));
app.set('view engine', 'pug');

app.get('/', async (req, res) => {
  try {
    const servicesList = await getAvailableServices();
    res.render('index', {
      services: servicesList,
      chefService: {
        status: await chefStatus(),
        name: 'chef-client',
      },
      hostname: await hostname(),
      ok: true,
    });
  } catch (err) {
    console.log(err);
    res.json({ ok: false });
  }
});

app.get('/chefStart', async (req, res) => {
  try {
    console.log('chefStart');
    execCmd('/usr/bin/sudo /usr/bin/chef-client'); // no wait
    res.json({
      ok: true,
    });
  } catch (err) {
    console.log(err);
    res.json({ ok: false });
  }
});

app.get('/chefKill', async (req, res) => {
  try {
    const commandResult = await execCmd('/usr/bin/sudo killall -s 9 chef-client');
    console.log('chefKill', commandResult);
    res.json({
      ok: true,
    });
  } catch (err) {
    console.log(err);
    res.json({ ok: false });
  }
});

app.get('/serviceOn/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const commandResult = await execCmd(`/usr/bin/sudo /usr/bin/sv start /etc/service/${name}`);
    // commandResult = mock.svStartResult;
    console.log(name, commandResult);
    res.json({
      ok: commandResult.startsWith('ok'),
    });
  } catch (err) {
    console.log(err);
    res.json({ ok: false });
  }
});

app.get('/serviceOff/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const commandResult = await execCmd(`/usr/bin/sudo /usr/bin/sv -v -w 30 force-stop /etc/service/${name}`);
    // commandResult =  mock.svStopResult;
    console.log(name, commandResult);
    res.json({
      ok: commandResult.startsWith('ok') || commandResult.startsWith('kill'),
    });
  } catch (err) {
    console.log(err);
    res.json({ ok: false });
  }
});

app.get('/serviceRestart/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const commandResult = await execCmd(`/usr/bin/sudo /usr/bin/sv -v -w 30 force-restart /etc/service/${name}`);
    // commandResult = exports.svRestartResult;
    console.log(name, commandResult);
    res.json({
      ok: commandResult.startsWith('ok') || commandResult.startsWith('kill'),
    });
  } catch (err) {
    console.log(err);
    res.json({ ok: false });
  }
});

app.listen(process.env.PORT || 3000);

