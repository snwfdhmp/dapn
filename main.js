/*
	DAPN: Decentralized Authenticated Private Network

	usage:
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
*/

const { Command } = require("commander")
const program = new Command()
const { version } = require("./package.json")
const axios = require("axios")
const httpServer = require("express")()

let myUsername = ""
let myIp = ""
let myPort = ""
let knownUsers = {}
let boundUsers = {}
let exposedPorts = {}

program.version(version)

program
  .command("bind <user>")
  .description("bind to a user")
  .option("-l, --local <localIp>", "local ip to use")
  .option("-r, --remote <publicIp:publicPort>", "public address to use")
  .action((user, options) => {
    /* if the user ip is known, dapn will use it
			else dapn will broadcast a bind request to every connected user, if the user knows the targeted user, they will forward the bind request to the user
			when the ip is known, dapn will connect to the user and send a bind request
			if the user accepts the bind request, each user will assign an ip to the user and will start forwarding traffic from and to the user on all exposed ports from the exported port list
			if the user rejects the bind request, dapn will exit with an error
		*/

    let targetIp
    let targetPort

    // did the user provide a remote address ?
    if (options.remote) {
      // use provided remote address
      const [ip, port] = options.remote.split(":")
      targetIp = ip
      targetPort = port
    }

    // if we don't have a remote address, is the user known ?
    if (knownUsers[user]) {
      // use known ip
      targetIp = knownUsers[user].ip
      targetPort = knownUsers[user].port
    } else {
      // broadcast bind request to bound users and wait for response
      for (const username in boundUsers) {
        axios.post(
          `http://${boundUsers[username].ip}:${boundUsers[username].port}/request/bind`,
          {
            target: user,
          }
        )
      }
    }

    // if we have a target ip, request the user for binding
    if (targetIp) {
      axios.post(`http://${targetIp}:${targetPort}/request/bind`, {
        target: user,
      })
    }
  })

// dapn expose <port>
program
  .command("expose <port>")
  .description("expose a port")
  .action((port) => {
    // dapn will add port to the list of exposed ports
    exposedPorts[port] = true
  })

// dapn bound
program
  .command("bound")
  .description("list bound users")
  .action(() => {
    // dapn will list all bound users
    console.log(boundUsers)
  })

// dapn exposed
program
  .command("exposed")
  .description("list exposed ports")
  .action(() => {
    // dapn will list all exposed ports
    console.log(exposedPorts)
  })

// dapn unbind <user>
program
  .command("unbind <user>")
  .description("unbind from a user")
  .action((user) => {
    // dapn will notify user that their is no longer bound
    axios.post(`http://${boundUsers[user].ip}:${boundUsers[user].port}/unbind`)
    // dapn will disconnect from the user and will stop forwarding traffic from and to the user as well as stop assigning an ip to the user on all exposed ports from the exported port list
    unbindUser(user)
  })

// listen for request bind requests
httpServer.post("/request/bind", (req, res) => {
  const { target } = req.body

  const { dapnOriginIp, dapnOriginPort } = req.headers

  // if its me
  if (target === myUsername) {
    // send my ip and port
    axios.post(`http://${dapnOriginIp}:${dapnOriginPort}/bind`, {
      headers: {
        dapnOriginUser: myUsername,
        dapnOriginIp: myIp,
        dapnOriginPort: myPort,
      },
    })
  } else if (knownUsers[target]) {
    // if i know the user
    // forward bind request to target
    axios.post(
      `http://${knownUsers[target].ip}:${knownUsers[target].port}/broadcast/bind`,
      {
        target: target,
      }
    )
  }
})

httpServer.post("/bind", (req, res) => {
  const { ip, port } = req.body

  const { dapnOriginUser, dapnOriginIp, dapnOriginPort } = req.headers

  bindUser(dapnOriginUser, dapnOriginIp, dapnOriginPort)
})

// listen for request bind requests
httpServer.post("/request/bind", (req, res) => {
  const { target } = req.body

  // if its me
  if (target === myUsername) {
    // send my ip and port
    res.send({
      ip: myIp,
      port: myPort,
    })
  } else if (knownUsers[target]) {
    // if i know the user
    // forward bind request to target
    axios.post(
      `http://${knownUsers[target].ip}:${knownUsers[target].port}/broadcast/bind`,
      {
        target: target,
      }
    )
  }
})

const bindUser = (user, remoteIp, remotePort, localIp) => {
  if (!localIp) {
    // find a free ip on the local interface
    child_process.exec(
      `ip addr show dev ${localInterface}`,
      (err, stdout, stderr) => {
        const ip = stdout.split("inet ")[1].split("/")[0]
        const [ip1, ip2, ip3, ip4] = ip.split(".")
        for (let i = 1; i < 255; i++) {
          const ip = `${ip1}.${ip2}.${ip3}.${i}`
          child_process.exec(
            `ip addr show dev ${localInterface} | grep ${ip}`,
            (err, stdout, stderr) => {
              if (!stdout) {
                localIp = ip
              }
            }
          )
        }
      }
    )
    if (!localIp) {
      console.error("no free ip found")
      return
    }
  }

  // create a tunnel interface to users ip
  // forward traffic from and to the user on all exposed ports from the exported port list
  child_process.exec(`ip tuntap add dev ${user} mode tun`)
  // the above command will create a tun interface named user
  // a tun interface is a virtual network interface that can be used to create a virtual point-to-point network connection
  // the tun interface will be used to forward traffic from and to the user
  // the tun interface will be assigned an ip address
  // the tun interface will be assigned a route to the user ip

  child_process.exec(`ip addr add ${localIp} dev ${user}`)
  // the above command will assign an ip address to the tun interface

  child_process.exec(`ip link set ${user} up`)
  // the above command will bring the tun interface up

  child_process.exec(`ip route add ${remoteIp} dev ${user}`)
  // the above command will assign a route to the tun interface

  child_process.exec(`iptables -t nat -A POSTROUTING -o ${user} -j MASQUERADE`)
  // the above command will masquerade the tun interface traffic

  child_process.exec(
    `iptables -A FORWARD -i ${user} -o ${user} -m state --state RELATED,ESTABLISHED -j ACCEPT`
  )
  // the above command will accept traffic from and to the tun interface

  child_process.exec(`iptables -A FORWARD -i ${user} -o ${user} -j ACCEPT`)
  // the above command will accept traffic from and to the tun interface

  // for all exposed ports
  for (const port in exposedPorts) {
    child_process.exec(
      `iptables -t nat -A PREROUTING -p tcp --dport ${port} -j DNAT --to-destination ${remoteIp}:${remotePort}`
    )
    // the above command will forward traffic from the exposed port to the user ip and port
  }
}

const unbindUser = (user) => {
  // remove the tunnel interface to users ip
  // stop forwarding traffic from and to the user on all exposed ports from the exported port list
  child_process.exec(`ip tuntap del dev ${user} mode tun`)
  // the above command will remove the tun interface
}

const main = async () => {
  program.name("dapn").parse(process.argv)
}

main()
