var express = require('express');
var Request = require('request');
var cors = require('cors')
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectId;
var jwt = require('jsonwebtoken');
var expressjwt = require('express-jwt');
var bodyParser = require('body-parser');
const url = require('url');

const JWT_SECRET = 'descloudsecreT';

if (process.env.ENV == 'dev') {
    var CLIENT_ID = 'cdc75e6ed850a032a91a';
    var CLIENT_SECRET = '21f337e18268ffc36213f199a92552deb4ca89b5';
} else {
    var CLIENT_ID = 'e86a6be6abe38a4c6a56';
    var CLIENT_SECRET = '9d4d633b29b4540461ce2339995848b8173101a5';
}
const RANCHER_USER = 'CBCA67D9254C7C52D0C0';
const RANCHER_PASS = 'R45874piapVw45Sgyp7XogBJu7RLgm3HyEHEed2k';

var mongo_addr = process.env.MONGO_ADDR || 'localhost:27017/descloud';

MongoClient.connect('mongodb://' + mongo_addr, function(err, db) {
    if (err) {
        console.log(err);
        return;
    }

    var app = express();
    app.use(cors());
    app.use(bodyParser.json());
    app.use(expressjwt({secret: JWT_SECRET}).unless({path: ['/token']}));
    app.use(function(err, req, res, next) {
        if (err.name === 'UnauthorizedError') {
            res.status(401).send({
                error: 'Unauthorized'
            });
        }
    });

    app.get('/token', function(req, res) {
        Request.post({
            url: 'https://github.com/login/oauth/access_token',
            json: {
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: req.query.code
            }
        }, function(err, httpResponse, body) {
            console.log(body)
            if (body.error) {
                res.status(401).send({
                    error: 'Unauthorized'
                });
                return;
            }
            var github_token = body.access_token;
            Request.get({
                url: 'https://api.github.com/user?access_token=' + body.access_token,
                headers: {
                    'User-Agent': 'descloud'
                }
            }, function(err, httpResponse, body) {
                var body = JSON.parse(body);
                db.collection('users').findOne({github_id: body.id}, function(err, item) {
                    if (!item) {
                        var payload = {
                            github_id: body.id,
                            username: body.login,
                            email: body.email,
                            avatar: body.avatar_url,
                            github_token: github_token,
                            github_info: body,
                            created_at: new Date(),
                            updated_at: new Date()
                        };
                        db.collection('users').insertOne(payload, function(err, r) {
                            var token = jwt.sign(payload._id.toString(), JWT_SECRET);
                            res.send({token: token});
                        })
                    } else {
                        var token = jwt.sign(item._id.toString(), JWT_SECRET);
                        res.send({token: token});
                    }
                })


            })
        });
    });

    app.get('/user', function(req, res) {
        db.collection('users').findOne({_id: new ObjectId(req.user)}, function(err, item) {
            res.send(item)
        });
    });

    app.get('/users', function(req, res) {
        db.collection('users').findOne({_id: new ObjectId(req.user)}, function(err, item) {
            res.send(item)
        });
    });

    app.get('/desktops', function(req, res) {
        db.collection('desktops').find({user_id: req.user}).toArray(function(err, items) {
            if (err)
                console.log(err)
            res.send(items);
        })
    });

    app.post('/desktops', function(req, res) {
        var data = {
            instanceTriggeredStop: "stop",
            startOnCreate: true,
            publishAllPorts: false,
            privileged: false,
            stdinOpen: true,
            tty: true,
            readOnly: false,
            networkMode: "bridge",
            type: "container",
            secrets: [],
            dataVolumes: [],
            dataVolumesFrom: [],
            dns: [],
            dnsSearch: [],
            capAdd: [],
            capDrop: [],
            devices: [],
            logConfig: {"driver": "", "config": {}},
            dataVolumesFromLaunchConfigs: [],
            imageUuid: "docker:daocloud.io/guodong/pulsar-desktop1:latest",
            ports: ["5678/tcp"],
            instanceLinks: {},
            labels: {
                "io.rancher.scheduler.affinity:host_label": "cloudware=true"
            },
            networkContainerId: null,
            count: null,
            createIndex: null,
            created: null,
            deploymentUnitUuid: null,
            description: null,
            externalId: null,
            firstRunning: null,
            healthState: null,
            hostname: null,
            kind: null,
            memoryReservation: null,
            milliCpuReservation: null,
            removed: null,
            startCount: null,
            uuid: null,
            volumeDriver: null,
            workingDir: null,
            user: null,
            domainName: null,
            memorySwap: null,
            memory: 134217728 * 4, // 128m*4
            cpuSet: null,
            cpuShares: null,
            pidMode: null,
            blkioWeight: null,
            cgroupParent: null,
            usernsMode: null,
            pidsLimit: null,
            diskQuota: null,
            cpuCount: null,
            cpuPercent: null,
            ioMaximumIOps: null,
            ioMaximumBandwidth: null,
            cpuPeriod: null,
            cpuQuota: null,
            cpuSetMems: null,
            isolation: null,
            kernelMemory: null,
            memorySwappiness: null,
            shmSize: null,
            uts: null,
            ipcMode: null,
            stopSignal: null,
            oomScoreAdj: null,
            ip: null,
            ip6: null,
            healthInterval: null,
            healthTimeout: null,
            healthRetries: null
        };
        Request.post({
            url: 'http://rancher.cloudwarehub.com:8080/v2-beta/projects/1a5/container',
            method: 'POST',
            auth: {
                user: RANCHER_USER,
                pass: RANCHER_PASS
            },
            json: data
        }, function(err, httpResponse, body) {
            console.log(body);
            var rancher_container_id = body.id;
            var container_id = body.uuid;

            setTimeout(function() {
                Request.get({
                    url: 'http://rancher.cloudwarehub.com:8080/v2-beta/projects/1a5/containers/' + body.id + '/ports',
                    auth: {
                        user: RANCHER_USER,
                        pass: RANCHER_PASS
                    },
                }, function(err, hr, body) {
                    console.log(body);
                    var d = JSON.parse(body);
                    var port = d.data[0].publicPort;
                    var data = {
                        user_id: req.user,
                        name: req.body.name,
                        port: port,
                        rancher_container_id: rancher_container_id,
                        container_id: container_id,
                        created_at: new Date(),
                        updated_at: new Date()
                    };
                    db.collection('desktops').insertOne(data, function(err, r) {
                        res.send(data);
                    });
                });
            }, 6000);
        });

    });

    //app.get('/desktops/:id', function(req, res) {
    db.collection('desktops').findOne({_id: new ObjectId(req.params.id)}, function(err, item) {
        res.send(item);
    });

    app.delete('/desktops/:id', function(req, res) {
        db.collection('desktops').findOne({_id: new ObjectId(req.params.id)}, function(err, item) {
            if (item) {
                Request.delete({
                    url: 'http://rancher.cloudwarehub.com:8080/v2-beta/projects/1a5/containers/' + item.rancher_container_id,
                    auth: {
                        user: RANCHER_USER,
                        pass: RANCHER_PASS
                    },
                });
            }
            db.collection('desktops').remove({_id: new ObjectId(req.params.id)}, function(err, item) {
                res.send(item);
            });
        });
    });

    app.get('/terminal/token/:id', function(req, res) {
        db.collection('desktops').findOne({_id: new ObjectId(req.params.id)}, function(err, item) {
            if (!item) {
                res.status(404).send({
                    error: 'no resource'
                });
                return;
            }
            var data = {
                attachStdin: true,
                attachStdout: true,
                tty: true,
                command: [
                    "/bin/sh",
                    "-c",
                    "TERM=xterm-256color; export TERM; [ -x /bin/bash ] && ([ -x /usr/bin/script ] && /usr/bin/script -q -c \"/bin/bash\" /dev/null || exec /bin/bash) || exec /bin/sh"
                ]
            };
            Request.post({
                url: 'http://rancher.cloudwarehub.com:8080/v2-beta/containers/' + item.rancher_container_id + '/?action=execute',
                auth: {
                    user: RANCHER_USER,
                    pass: RANCHER_PASS
                },
                json: data
            }, function(err, hr, body) {
                res.send({token: body.token});
            })
        })


        app.listen(3000, function() {
            console.log('Example app listening on port 3000!')
        })

        /** ws server **/
// const WebSocket = require('ws');
//
// const wss = new WebSocket.Server({
//   perMessageDeflate: false,
//   port: 3001
// });
//
// wss.on('connection', function connection(ws) {
//   const location = url.parse(ws.upgradeReq.url, true);
//   if (!location.query.token || location.query.id) {
//     ws.send('params error');
//     ws.close();
//     return;
//   }
//   var token = location.query.token;
//   var id = location.query.id;
//   jwt.verify(token, JWT_SECRET, function(err, decoded) {
//     if (!decoded) {
//       ws.send('invalid token');
//       ws.close();
//       return;
//     }
//     db.collection('desktops').findOne({user_id: decoded, rancher_container_id: id}, function(err, item) {
//       if (!item) {
//         ws.send('not your resource');
//         ws.close();
//         return;
//       }
//
//     })
//   });
//   console.log(location.query.token)
//   ws.on('message', function incoming(message) {
//     console.log('received: %s', message);
//   });
//
//   ws.send('something');
// });
    })
})

// console.log(jwt.sign('58e924ae8efc34bad452b357', JWT_SECRET))
