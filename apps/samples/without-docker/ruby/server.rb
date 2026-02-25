require 'webrick'

server = WEBrick::HTTPServer.new(
  Port: 8000,
  BindAddress: '0.0.0.0'
)

server.mount_proc '/' do |req, res|
  res.status = 200
  res['Content-Type'] = 'text/plain'
  res.body = "Hello from Ruby HTTP server on port 8000"
end

trap('INT') { server.shutdown }

puts "Server running on http://localhost:8000"
server.start