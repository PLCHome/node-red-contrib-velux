# node-red-contrib-velux

> this is an Node for the API on the Velux&copy; KLF-200 io-homecontrol&copy; Gateway.
> (klf-200 provided by Velux&copy;. I'm not affiliated.)
> Velux&copy; KLF-200 io-homecontrol&copy; Gateway support for Node-Red.

This implementation is based on the API documentation [https://www.velux.com/api/klf200](https://www.velux.com/api/klf200).
It works only with the version 0.2.0.0.71 and above.

Up to the version 0.1.1.0.45 it was possible to access the KLF-200 web interface and rest API via the LAN interface. This does not work in version 0.2.0.0.71 anymore. Velux shared on demand with the Lan interface can only be addressed via the API.

Take a look at the [technical specification for klf 200 api.pdf](https://github.com/PLCHome/velux-klf200-api/blob/master/technical%20specification%20for%20klf%20200%20api.pdf)


For the latest updates see the [CHANGELOG.md](https://github.com/PLCHome/velux-klf200-api/blob/master/CHANGELOG.md)

# Install
```sh
cd ~/.node-red
npm install node-red-contrib-velux
```
---

### Currently tested with API 3.14 from 01.10.2018 version 0.2.0.0.71
---

### The connect password is the WLAN-Password not the web config password
---

### Requirements
* Velux KLF-200 on LAN
---
# Debug
This API supported debugging. you have to set the environment variable DEBUG
```
set DEBUG=velux-klf200-api:*,velux-klf200:*,node-red-contrib-velux:*
```
---


# Node-RED Nodes

## velux-connection

This node establishes the connection to the KLF200.
It is only possible to reach the KLF200 via a LAN. Some routers do not have a connection between the WLAN and the LAN from factory settings. Please read the manual if this is the case.

- **Host:** The IP address of the KLF 200
- **Password:** The password of the KLF200. Normally the WLAN password on the back

### keep alive and startup

After the connection is established, the following actions are performed:
- The date and time of the real-time clock in the KLF200 are set
- The system state and the version of the klf200 are queried
- The node states are queried
- The house status monitor is turned on

- Every 10 minutes, the system state is queried as a sign of life


## Velux Node

Velux calls all actors in the network nodes. Velux nodes can be Shutter / Rollers, Window opener and so on.
The output is output from time to time. Coming from the house status monitor. This sends the state of the velux node from time to time. When a status arrives, it is automatically written to the output of the node.

- **Datasource:** The data source is a velux-connection object. There should only be one for a KLF200. The KLF200 only allows two connections.
- **node index:** This is the index of the device (node) within the KLF200. In the dropdown, the index and the name are displayed when the combo box is empty.
- **send value:** This value is sent when a new value is received
 - *all values*: The node object is completely output, the values ​​can be looked up in the API description.
 - *currentPosition*: only the current position is output.
 - *target*: The target position is output.
 - *fp1CurrentPosition (-4)*: Some devices (nodes) have further function parameters. this is explained in the velux API description.
 - *remaining time*: The remaining time to position.
- **topic:** This node sends a topic, either this text or the velux node name. and see input
- **name:** The name is displayed on the node

###### The Input
The msg.payload can be an `numeric value` or an object like
`{value: <val>, valueType: <type>}` or `{rawValue: <val>}`. The rawValue is preferred.

The msg.topic can control what happens to the input.

If the topic starts with `velux:` this is possible:
- `velux:read` Like setting, see above, the value is output from the buffer
- `velux:load` Like setting, see above, the value is requested and output at the KLF200
- `velux:read:id:<id>` -1 all values ​​or velux-node id for read. The settings are ignored.
- `velux:load:id:<id>` -1 all values ​​or velux-node id for load. The settings are ignored.
- `velux:read:name:<name>` Read the value by velux-node name. The settings are ignored.
- `velux:load:name:<name>` Load the value by velux-node name. The settings are ignored.

- `velux:write` Like setting, see above, the value is send to the velux-node
- `velux:write:[name:<name>:][id:<id>:][valuetype:<valuetype>:]` Overwrite the settings, the Payload must be an float value. []=optional, id and name together make no sense.

If a topic was specified in the settings and the tropic is not `velux:...` the topic must match or be empty otherwise the input will be discarded

##### The valuetype
<table>
<tr><td>valuetype</td><td>Access Method name for Standard Parameter</td><td>Description</td><td>rawValue Range (Hex)</td></tr>
<tr><td>RELATIVE</td><td>Relative</td><td>Relative value (0 – 100%)</td><td>0x0000–0xC800</td></tr>
<tr><td>RELATIVE</td><td>Relative</td><td>No feed-back value known</td><td>0xF7FF</td></tr>
<tr><td>PERCENT_PM</td><td>Percent+-</td><td>Percentage point plus or minus (-100% – 100%)</td><td>0xC900-0xD0D0</td></tr>
<tr><td>TARGET</td><td>Target</td><td>The target value for the parameter</td><td>0xD100</td></tr>
<tr><td>CURRENT</td><td>Current</td><td>The current value for the parameter</td><td>0xD200</td></tr>
<tr><td>DEFAULT</td><td>Default</td><td>The default value for the parameter</td><td>0xD300</td></tr>
<tr><td>IGNORE</td><td>Ignore</td><td>Ignore the parameter field where this Access Method is written</td><td>0xD400</td></tr>
</table>

## Velux Scene
coming soon

## Velux API

The direct route to the velux API. You can send commands or receive notifications.

- **Datasource:** The data source is a velux-connection object. There should only be one for a KLF200. The KLF200 only allows two connections.
- **node index:** This is the index of the device (node) within the KLF200. In the dropdown, the index and the name are displayed when the combo box is empty.
- **API:** The api command to send. The payload must be an Object. Maybe you must add some parameters. Take a look at the [technical specification for klf 200 api.pdf](https://github.com/PLCHome/velux-klf200-api/blob/master/technical%20specification%20for%20klf%20200%20api.pdf). Also take an look at the [API source](https://github.com/PLCHome/velux-klf200-api/blob/master/lib/klf.js). The parameters starts with a small bush letter. You can override the selected api with an payload.api or an payload.apiText parameter.
- **listen NTF:** The api notification to listen. You can choose from everything to nothing.
- **topic:** This node checks a topic. If the topic is entered the topic must match. 
- **name:** The name is displayed on the node



License (MIT)
-------------
Copyright (c) 2018 Chris Traeger

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
