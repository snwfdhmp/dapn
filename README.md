# DAPN: Decentralized Authenticated Private Network

## Usage

```
$ dapn bind <user> [--local <localIp>] [--remote <publicIp>]
	if the user ip is known, dapn will use it
	else dapn will broadcast a bind request to every connected user, if the user knows the targeted user, they will forward the bind request to the user
	when the ip is known, dapn will connect to the user and send a bind request
	if the user accepts the bind request, each user will assign an ip to the user and will start forwarding traffic from and to the user on all exposed ports from the exported port list
	if the user rejects the bind request, dapn will exit with an error
$ dapn unbind <user>
	dapn will notify user that their is no longer bound
	dapn will disconnect from the user and will stop forwarding traffic from and to the user as well as stop assigning an ip to the user on all exposed ports from the exported port list
$ dapn expose <port>
	dapn will add port to the list of exposed ports
$ dapn bound
	dapn will list all bound users
$ dapn exposed
	dapn will list all exposed ports
```
