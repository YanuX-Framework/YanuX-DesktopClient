const _ = require('lodash');
const path = require('path');
const express = require('express');
const request = require('request');

module.exports = class HTTPServer {
    constructor(config, brokerConnection) {
        this.config = config;
        this.brokerConnection = brokerConnection;
        this.app = express();
        /** TODO: Refine the CORS policy! */
        this.app.use(function (req, res, next) {
            res.header("Access-Control-Allow-Origin", "*");
            next();
        });
        this.app.get('/', (req, res) => {
            if (req.query.code) {
                request.post({
                    url: this.config.oauth2_authorization_server_url + 'oauth2/token',
                    auth: {
                        user: this.config.client_id,
                        pass: this.config.client_secret,
                        sendImmediately: true
                    },
                    form: {
                        code: req.query.code,
                        grant_type: 'authorization_code',
                        redirect_uri: this.config.redirect_uri
                    },
                    json: true
                }, (err, resp, body) => {
                    if (err) { return console.log(err); }
                    if (_.isNil(body.error)) {
                        res.sendFile(path.join(__dirname + '/../public/success.html'));
                        this.config.access_token = body.access_token;
                        this.config.refresh_token = body.refresh_token;
                        this.config.save(err => {
                            if (err) { throw err; }
                            else { brokerConnection.connect(); }
                        });
                    } else {
                        res.sendFile(path.join(__dirname + '/../public/error.html'));
                        console.log("The following error has occurred while trying to exchange and authorization code for an access and refresh tokens:",
                            JSON.stringify(body, null, this.config.DEFAULT_STRINGIFY_SPACES));
                    }
                });
            } else {
                res.sendFile(path.join(__dirname + '/../public/index.html'));
            }
        });
        this.app.get('/deviceInfo', (req, res) => {
            res.json({ deviceUuid: this.config.device_uuid });
            res.end();
        });
    }
    get config() {
        return this._config;
    }
    set config(config) {
        this._config = config;
    }
    get brokerConnection() {
        return this._brokerConnection;
    }
    set brokerConnection(brokerConnection) {
        this._brokerConnection = brokerConnection;
    }
    listen() {
        this.app.listen(this.config.http_server_port, () => console.log(`Started YanuX IPS Desktop Client HTTP Server on port ${this.config.http_server_port}!`));
    }
    close() {
        this.app.close();
    }
}
