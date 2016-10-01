$(document).ready(function () {

    function parse(val) {
        var result = "Not found",
            tmp = [];
        location.search
            //.replace("?", "")
            // this is better, there might be a question mark inside
            .substr(1)
            .split("&")
            .forEach(function (item) {
                tmp = item.split("=");
                if (tmp[0] === val) result = decodeURIComponent(tmp[1]);
            });
        return result;
    }
    var myusername = parse('user');

    $('#user_name').html(myusername);

    var client = new Client('http://localhost:8080', myusername);
});
